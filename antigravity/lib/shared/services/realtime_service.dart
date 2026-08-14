import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as socket_io;
import 'package:tasko/core/config/api_config.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/shared/services/app_check_service.dart';

/// Thin, injectable facade over a Socket.IO socket so [RealtimeService] stays
/// unit testable (`socket_io.io` cannot be constructed in tests). Mirrors how
/// `PushMessaging`/`FcmPushMessaging` abstracts the FCM plugin.
abstract class RealtimeConnection {
  /// Opens the connection. Safe to call on an already-open socket.
  void connect();

  /// Closes the connection (no auto-reconnect for a client-initiated close).
  void disconnect();

  /// Sends a client→server event (the only one is `typing`; all writes go
  /// over REST — the architectural rule).
  void emit(String event, [Object? data]);

  /// Registers a handler for a server→client wire event.
  void on(String event, void Function(dynamic data) handler);

  void onConnect(void Function() handler);

  void onDisconnect(void Function(dynamic reason) handler);

  void onConnectError(void Function(dynamic error) handler);

  /// Wire-level `error` events (e.g. `RATE_LIMITED`), distinct from
  /// [onConnectError] which is transport/handshake failures.
  void onError(void Function(dynamic error) handler);

  /// Disconnects and drops every registered handler.
  void dispose();
}

/// Real Socket.IO implementation backed by `socket_io_client`.
class SocketIoConnection implements RealtimeConnection {
  SocketIoConnection(this._socket);

  final socket_io.Socket _socket;

  @override
  void connect() => _socket.connect();

  @override
  void disconnect() => _socket.disconnect();

  @override
  void emit(String event, [Object? data]) => _socket.emit(event, data);

  @override
  void on(String event, void Function(dynamic data) handler) =>
      _socket.on(event, handler);

  @override
  void onConnect(void Function() handler) => _socket.onConnect((_) => handler());

  @override
  void onDisconnect(void Function(dynamic reason) handler) =>
      _socket.onDisconnect(handler);

  @override
  void onConnectError(void Function(dynamic error) handler) =>
      _socket.onConnectError(handler);

  @override
  void onError(void Function(dynamic error) handler) =>
      _socket.on('error', handler);

  @override
  void dispose() {
    _socket.disconnect();
    _socket.clearListeners();
  }
}

/// Builds a [RealtimeConnection] for a [RealtimeService]. Injected in tests so
/// the socket can be substituted with a fake (the real one auto-connects and
/// needs a live server).
typedef RealtimeConnectionFactory = RealtimeConnection Function(
  String uri,
  socket_io.OptionBuilder options,
);

RealtimeConnection _defaultConnectionFactory(
  String uri,
  socket_io.OptionBuilder options,
) =>
    SocketIoConnection(socket_io.io(uri, options.build()));

/// The Section 3.4 wire envelope for a server→client realtime event.
///
/// This is NOT the HTTP `{ success, data }` envelope — sockets carry
/// `eventId`/`occurredAt`/`actor` so clients can dedupe and attribute.
@immutable
class RealtimeEnvelope {
  const RealtimeEnvelope({
    required this.eventName,
    required this.eventId,
    required this.occurredAt,
    required this.actorUserId,
    required this.payload,
  });

  /// The wire event name (`task.created`, `comment.added`, `user.online`, ...)
  /// that carried this envelope — lets providers branch without a dedicated
  /// callback per event.
  final String eventName;

  /// The domain event id — dedup/logging key.
  final String eventId;

  /// ISO-8601 timestamp from the originating domain event.
  final String occurredAt;

  /// The user whose action produced the event. Absent on `member.removed`
  /// (the removed user is the subject, not the actor — Section 3.4).
  final String? actorUserId;

  /// Reuses the exact REST output-DTO shapes (`TaskOutput`, `CommentOutput`)
  /// so the client models one class per entity across both transports.
  final Map<String, dynamic> payload;
}

/// Owns the single Socket.IO connection to the Tasko backend.
///
/// One socket per app, one place owning the connection lifecycle. `main.dart`
/// wires the session-expired / reconnect callbacks; the auth layer invokes
/// [connect] on login/restore and [disconnect] on logout. The service is null
/// in widget tests, so every hook no-ops — the `PushService`/`CrashlyticsService`
/// null-instance convention.
///
/// Handshake failures are recovered exactly like the HTTP layer's 401 path:
/// the token is refreshed once (reusing `ApiClient.refreshAccessToken`, which
/// serializes concurrent refreshes) and the connection is retried with the
/// rotated token; if the refresh fails the session is considered expired.
/// Transient drops are left to `socket_io_client`'s built-in auto-reconnect,
/// and [onReconnected] fires so current state can be re-fetched over REST
/// (Section 8 — no server-side event replay in v1).
class RealtimeService {
  RealtimeService({
    AppServices? services,
    String? baseUrl,
    RealtimeConnectionFactory? connectionFactory,
  })  : _services = services ?? AppServices.instance,
        _baseUrl = baseUrl ?? ApiConfig.baseUrl,
        _connectionFactory = connectionFactory ?? _defaultConnectionFactory;

  /// Set once in `main.dart`; the auth hooks no-op when null (widget tests).
  static RealtimeService? instance;

  final AppServices _services;
  final String _baseUrl;
  final RealtimeConnectionFactory _connectionFactory;

  RealtimeConnection? _connection;
  bool _connecting = false;
  bool _connected = false;
  bool _everConnected = false;
  bool _refreshAttempted = false;

  // ── Typed coarse handlers (wired by main.dart in R7) ──────────────────────
  //
  // Each receives the parsed [RealtimeEnvelope]. `member.removed` has no
  // actor; the remaining fields follow Section 3.4.

  /// `task.created` / `task.updated` / `task.completed` / `task.reopened` /
  /// `task.deleted` — payload is the `TaskOutput` (or `TaskDeletedPayload`).
  void Function(RealtimeEnvelope envelope)? onTaskEvent;

  /// `comment.added` — payload is `{ comment, task }`.
  void Function(RealtimeEnvelope envelope)? onCommentEvent;

  /// `user.online` / `user.offline` — payload is `{ userId }`.
  void Function(RealtimeEnvelope envelope)? onPresence;

  /// `typing` relay — payload is `{ taskId, userId, isTyping }`.
  void Function(RealtimeEnvelope envelope)? onTyping;

  /// `member.removed` — payload is `{ teamId, userId }` (no actor).
  void Function(RealtimeEnvelope envelope)? onMemberRemoved;

  /// `invitation.accepted` — payload is
  /// `{ teamId, invitedEmail, invitedBy }`.
  void Function(RealtimeEnvelope envelope)? onInvitationAccepted;

  /// Invoked when the session can no longer be recovered (a handshake is
  /// rejected and the token refresh fails). Wired in `main.dart` to sign the
  /// user out — the login-screen path.
  VoidCallback? onSessionExpired;

  /// Invoked on every successful reconnect after the first connection, so
  /// `main.dart` can re-fetch current state over REST (Section 8).
  VoidCallback? onReconnected;

  // ── Screen-scoped subscriptions (Section 10.2) ─────────────────────────────
  //
  // Coarse handlers above are wired once in `main.dart` for global state;
  // these registries let a screen subscribe in `initState` and unsubscribe in
  // `dispose` without clobbering the global handlers.

  final List<void Function(RealtimeEnvelope)> _commentSubscribers = [];
  final List<void Function(RealtimeEnvelope)> _typingSubscribers = [];
  final List<void Function(RealtimeEnvelope)> _memberRemovedSubscribers = [];

  /// Registers a live-comment listener (e.g. `CommentsScreen`). Returns an
  /// unsubscribe function; no-op when [RealtimeService.instance] is null.
  VoidCallback subscribeComment(void Function(RealtimeEnvelope) handler) {
    _commentSubscribers.add(handler);
    return () => _commentSubscribers.remove(handler);
  }

  /// Registers a typing-indicator listener (e.g. `CommentsScreen`).
  VoidCallback subscribeTyping(void Function(RealtimeEnvelope) handler) {
    _typingSubscribers.add(handler);
    return () => _typingSubscribers.remove(handler);
  }

  /// Registers a member-removed listener (e.g. `TeamDetailsScreen` roster).
  VoidCallback subscribeMemberRemoved(
      void Function(RealtimeEnvelope) handler) {
    _memberRemovedSubscribers.add(handler);
    return () => _memberRemovedSubscribers.remove(handler);
  }

  /// Whether a socket is currently connected.
  bool get isConnected => _connected;

  /// Opens the realtime socket. Reads the current access token from the
  /// shared [AppServices.tokenStore]; no-ops when no token exists (signed
  /// out) or a connection is already established/connecting.
  Future<void> connect() async {
    if (_connection != null || _connecting) return;
    _connecting = true;
    try {
      final token = await _services.tokenStore.readAccessToken();
      if (token == null || token.isEmpty) return;
      _open(token, await _fetchAppCheckToken());
    } finally {
      _connecting = false;
    }
  }

  /// Closes the socket and resets lifecycle state. Called on logout.
  void disconnect() {
    _connecting = false;
    _everConnected = false;
    _refreshAttempted = false;
    _teardown();
  }

  /// Relays a comment-typing indicator to the server, which stamps the real
  /// `userId` and broadcasts to the team room. No-op when not connected.
  void sendTyping({required String taskId, required bool isTyping}) {
    final connection = _connection;
    if (connection == null || !_connected) return;
    connection.emit('typing', {'taskId': taskId, 'isTyping': isTyping});
  }

  // ── Connection lifecycle ──────────────────────────────────────────────────

  /// The Firebase App Check attestation is sent in the handshake so the
  /// gateway can verify it in monitor mode (Section 11.2 / R8). Returns null
  /// when App Check is not active (dev builds), mirroring how the HTTP layer
  /// conditionally attaches the `X-Firebase-AppCheck` header.
  Future<String?> _fetchAppCheckToken() async {
    try {
      return await AppCheckService.instance?.getToken();
    } catch (error) {
      debugPrint('RealtimeService: app check token unavailable: $error');
      return null;
    }
  }

  void _open(String token, [String? appCheckToken]) {
    _refreshAttempted = false;
    _connected = false;
    final auth = <String, dynamic>{'token': token};
    if (appCheckToken != null && appCheckToken.isNotEmpty) {
      auth['appCheckToken'] = appCheckToken;
    }
    final options = socket_io.OptionBuilder()
        .disableAutoConnect()
        .setTransports(['websocket'])
        .setAuth(auth);
    final connection = _connectionFactory(_baseUrl, options);
    _connection = connection;
    _registerHandlers(connection);
    connection.connect();
  }

  void _registerHandlers(RealtimeConnection connection) {
    connection.onConnect(_handleConnect);
    connection.onDisconnect(_handleDisconnect);
    connection.onConnectError(_handleConnectError);
    connection.onError(_handleWireError);
    connection.on('auth_error', _handleAuthError);

    connection.on('task.created', (d) => _dispatch('task.created', d));
    connection.on('task.updated', (d) => _dispatch('task.updated', d));
    connection.on('task.completed', (d) => _dispatch('task.completed', d));
    connection.on('task.reopened', (d) => _dispatch('task.reopened', d));
    connection.on('task.deleted', (d) => _dispatch('task.deleted', d));
    connection.on('comment.added', (d) => _dispatch('comment.added', d));
    connection.on('invitation.accepted', (d) =>
        _dispatch('invitation.accepted', d));
    connection.on('member.removed', (d) => _dispatch('member.removed', d));
    connection.on('user.online', (d) => _dispatch('user.online', d));
    connection.on('user.offline', (d) => _dispatch('user.offline', d));
    connection.on('typing', (d) => _dispatch('typing', d));
  }

  void _handleConnect() {
    final firstConnection = !_everConnected;
    _everConnected = true;
    _connected = true;
    if (!firstConnection) {
      onReconnected?.call();
    }
  }

  void _handleDisconnect(dynamic reason) {
    _connected = false;
    debugPrint('RealtimeService: disconnected: $reason');
  }

  void _handleWireError(dynamic error) {
    debugPrint('RealtimeService: wire error: $error');
  }

  Future<void> _handleAuthError(dynamic data) async {
    debugPrint('RealtimeService: auth error: $data');
    await _refreshAndRetry();
  }

  Future<void> _handleConnectError(dynamic error) async {
    debugPrint('RealtimeService: connect error: $error');
    await _refreshAndRetry();
  }

  /// Refreshes the access token once (the same serialized refresh path the
  /// HTTP layer uses) and retries the connection with the rotated token. On
  /// refresh failure the session is considered expired.
  Future<void> _refreshAndRetry() async {
    if (_connection == null || _refreshAttempted) return;
    _refreshAttempted = true;
    _teardown();
    final newToken = await _services.apiClient.refreshAccessToken();
    if (newToken == null || newToken.isEmpty) {
      _failSession();
      return;
    }
    _open(newToken, await _fetchAppCheckToken());
  }

  void _failSession() {
    _teardown();
    _services.apiClient.onSessionExpired?.call();
    onSessionExpired?.call();
  }

  void _teardown() {
    final connection = _connection;
    _connection = null;
    _connected = false;
    connection?.dispose();
  }

  // ── Event routing ─────────────────────────────────────────────────────────

  static RealtimeEnvelope? _parseEnvelope(String event, dynamic data) {
    if (data is! Map<String, dynamic>) return null;
    final payload = data['payload'];
    if (payload is! Map<String, dynamic>) return null;
    return RealtimeEnvelope(
      eventName: event,
      eventId: data['eventId'] as String? ?? '',
      occurredAt: data['occurredAt'] as String? ?? '',
      actorUserId: (data['actor'] as Map<String, dynamic>?)?['userId']
          as String?,
      payload: payload,
    );
  }

  void _dispatch(String event, dynamic data) {
    final envelope = _parseEnvelope(event, data);
    if (envelope == null) {
      debugPrint('RealtimeService: malformed envelope for $event');
      return;
    }
    switch (event) {
      case 'task.created':
      case 'task.updated':
      case 'task.completed':
      case 'task.reopened':
      case 'task.deleted':
        onTaskEvent?.call(envelope);
      case 'comment.added':
        onCommentEvent?.call(envelope);
        for (final subscriber in List.of(_commentSubscribers)) {
          subscriber(envelope);
        }
      case 'invitation.accepted':
        onInvitationAccepted?.call(envelope);
      case 'member.removed':
        onMemberRemoved?.call(envelope);
        for (final subscriber in List.of(_memberRemovedSubscribers)) {
          subscriber(envelope);
        }
      case 'user.online':
      case 'user.offline':
        onPresence?.call(envelope);
      case 'typing':
        onTyping?.call(envelope);
        for (final subscriber in List.of(_typingSubscribers)) {
          subscriber(envelope);
        }
    }
  }
}
