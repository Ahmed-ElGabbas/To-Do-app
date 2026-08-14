import 'package:flutter_test/flutter_test.dart';
import 'package:socket_io_client/socket_io_client.dart' as socket_io;
import 'package:tasko/core/network/api_error.dart';
import 'package:tasko/shared/services/realtime_service.dart';

import 'core/network/test_services.dart';

/// Injectable stand-in for the socket so the connection lifecycle can be
/// driven deterministically in tests.
class FakeRealtimeConnection implements RealtimeConnection {
  final List<String> log = [];
  final Map<String, List<void Function(dynamic)>> handlers = {};
  final List<void Function()> connectHandlers = [];
  final List<void Function(dynamic)> disconnectHandlers = [];
  final List<void Function(dynamic)> connectErrorHandlers = [];
  final List<void Function(dynamic)> errorHandlers = [];

  @override
  void connect() => log.add('connect');

  @override
  void disconnect() => log.add('disconnect');

  @override
  void emit(String event, [Object? data]) => log.add('emit:$event');

  @override
  void on(String event, void Function(dynamic data) handler) =>
      (handlers[event] ??= []).add(handler);

  @override
  void onConnect(void Function() handler) => connectHandlers.add(handler);

  @override
  void onDisconnect(void Function(dynamic reason) handler) =>
      disconnectHandlers.add(handler);

  @override
  void onConnectError(void Function(dynamic error) handler) =>
      connectErrorHandlers.add(handler);

  @override
  void onError(void Function(dynamic error) handler) =>
      errorHandlers.add(handler);

  @override
  void dispose() => log.add('dispose');

  void fire(String event, [dynamic data]) {
    for (final handler in List.of(handlers[event] ?? const <void Function(dynamic)>[])) {
      handler(data);
    }
  }

  void fireConnect() {
    for (final handler in List.of(connectHandlers)) {
      handler();
    }
  }

  void fireDisconnect([dynamic reason]) {
    for (final handler in List.of(disconnectHandlers)) {
      handler(reason);
    }
  }

  void fireConnectError([dynamic error]) {
    for (final handler in List.of(connectErrorHandlers)) {
      handler(error);
    }
  }

  void fireError([dynamic error]) {
    for (final handler in List.of(errorHandlers)) {
      handler(error);
    }
  }
}

/// A valid Section 3.4 wire envelope; [withActor] can be toggled to model
/// `member.removed` (which carries no actor).
Map<String, dynamic> envelope(
  String id, {
  Map<String, dynamic>? payload,
  bool withActor = true,
}) =>
    {
      'eventId': 'evt-$id',
      'occurredAt': '2026-08-15T10:00:00.000Z',
      if (withActor) 'actor': {'userId': 'actor-$id'},
      'payload': payload ?? {'id': id},
    };

void main() {
  late TestBackend backend;
  late FakeRealtimeConnection fake;
  late socket_io.OptionBuilder? capturedOptions;
  late int factoryCalls;
  late RealtimeService service;

  RealtimeConnection fakeFactory(String uri, socket_io.OptionBuilder options) {
    factoryCalls++;
    capturedOptions = options;
    fake = FakeRealtimeConnection();
    return fake;
  }

  setUp(() {
    backend = TestBackend((options, attempt) =>
        throw StateError('no request expected'));
    factoryCalls = 0;
    capturedOptions = null;
    fake = FakeRealtimeConnection();
    service = RealtimeService(
      services: backend.services,
      baseUrl: 'http://test.local',
      connectionFactory: fakeFactory,
    );
  });

  group('connect', () {
    test('opens a websocket socket with the token as handshake auth',
        () async {
      await backend.storage.write(accessToken: 'tok-1', refreshToken: 'rt');

      await service.connect();

      expect(factoryCalls, 1);
      final opts = capturedOptions!.build();
      expect(opts['transports'], ['websocket']);
      expect(opts['auth'], {'token': 'tok-1'});
      expect(opts['autoConnect'], false);
      expect(fake.log, contains('connect'));
    });

    test('no-ops without a stored token', () async {
      await service.connect();

      expect(factoryCalls, 0);
    });

    test('is idempotent while a connection exists', () async {
      await backend.storage.write(accessToken: 'tok-1', refreshToken: 'rt');

      await service.connect();
      await service.connect();

      expect(factoryCalls, 1);
    });
  });

  test('disconnect() tears down and resets lifecycle state', () async {
    await backend.storage.write(accessToken: 'tok-1', refreshToken: 'rt');
    await service.connect();
    fake.fireConnect();
    expect(service.isConnected, isTrue);

    service.disconnect();

    expect(service.isConnected, isFalse);
    expect(fake.log, contains('dispose'));

    await service.connect();
    expect(factoryCalls, 2);
  });

  group('handshake recovery', () {
    test('connect_error refreshes the token and retries once', () async {
      await backend.storage.write(accessToken: 'expired', refreshToken: 'rt');
      backend.services.apiClient.refreshCallback = () async {
        await backend.storage.write(
          accessToken: 'fresh',
          refreshToken: 'rt-2',
        );
        return (accessToken: 'fresh', refreshToken: 'rt-2');
      };
      await service.connect();
      final first = fake;

      first.fireConnectError('auth failed');
      await pumpEventQueue();

      expect(first.log, contains('dispose'));
      expect(fake, isNot(same(first)));
      expect(factoryCalls, 2);
      expect(capturedOptions!.build()['auth'], {'token': 'fresh'});
    });

    test('auth_error refreshes the token and retries once', () async {
      await backend.storage.write(accessToken: 'expired', refreshToken: 'rt');
      backend.services.apiClient.refreshCallback = () async {
        await backend.storage.updateAccessToken('fresh');
        return (accessToken: 'fresh', refreshToken: 'rt-2');
      };
      await service.connect();

      fake.fire('auth_error', {'code': 'UNAUTHORIZED', 'message': 'expired'});
      await pumpEventQueue();

      expect(factoryCalls, 2);
      expect(capturedOptions!.build()['auth'], {'token': 'fresh'});
    });

    test('auth_error with a failed refresh expires the session', () async {
      await backend.storage.write(accessToken: 'bad', refreshToken: 'bad');
      backend.services.apiClient.refreshCallback =
          () async => throw const ApiException(message: 'refresh failed');
      backend.services.apiClient.onSessionExpired = () {
        backend.storage.clear();
      };
      var signedOut = 0;
      service.onSessionExpired = () => signedOut++;
      await service.connect();

      fake.fire('auth_error', {'code': 'UNAUTHORIZED', 'message': 'expired'});
      await pumpEventQueue();

      expect(signedOut, 1);
      expect(backend.storage.accessToken, isNull);
      expect(service.isConnected, isFalse);
    });

    test('connect_error without a refresh callback expires the session',
        () async {
      await backend.storage.write(accessToken: 'bad', refreshToken: 'bad');
      var signedOut = 0;
      service.onSessionExpired = () => signedOut++;
      await service.connect();

      fake.fireConnectError('boom');
      await pumpEventQueue();

      expect(signedOut, 1);
      expect(service.isConnected, isFalse);
    });

    test('a single refresh is attempted per failed connection', () async {
      await backend.storage.write(accessToken: 'bad', refreshToken: 'bad');
      backend.services.apiClient.refreshCallback =
          () async => throw const ApiException(message: 'refresh failed');
      var refreshes = 0;
      final original = backend.services.apiClient.refreshCallback;
      backend.services.apiClient.refreshCallback = () async {
        refreshes++;
        return original!();
      };
      var signedOut = 0;
      service.onSessionExpired = () => signedOut++;
      await service.connect();

      final first = fake;
      first.fireConnectError('1');
      first.fireConnectError('2');
      await pumpEventQueue();

      expect(refreshes, 1);
      expect(signedOut, 1);
    });
  });

  test('onReconnected fires after a transient drop, not on the first connect',
      () async {
    await backend.storage.write(accessToken: 'tok-1', refreshToken: 'rt');
    var reconnects = 0;
    service.onReconnected = () => reconnects++;
    await service.connect();

    fake.fireConnect();
    expect(reconnects, 0);

    fake.fireDisconnect('ping timeout');
    fake.fireConnect();
    expect(reconnects, 1);
  });

  group('event routing', () {
    test('dispatches wire events to the typed handlers', () async {
      await backend.storage.write(accessToken: 'tok-1', refreshToken: 'rt');
      final routed = <String>[];
      service.onTaskEvent = (e) => routed.add('task:${e.payload['id']}');
      service.onCommentEvent = (_) => routed.add('comment');
      service.onPresence = (e) => routed.add('presence:${e.payload['userId']}');
      service.onTyping = (_) => routed.add('typing');
      service.onMemberRemoved = (e) =>
          routed.add('member:${e.actorUserId ?? 'none'}');
      service.onInvitationAccepted = (_) => routed.add('invitation');
      await service.connect();

      fake.fire('task.created', envelope('t1'));
      fake.fire('task.updated', envelope('t1'));
      fake.fire('task.completed', envelope('t1'));
      fake.fire('task.reopened', envelope('t1'));
      fake.fire('task.deleted', envelope('t1'));
      fake.fire('comment.added', envelope('c1'));
      fake.fire('user.online', envelope('u1', payload: {'userId': 'u1'}));
      fake.fire('user.offline', envelope('u1', payload: {'userId': 'u1'}));
      fake.fire('typing', envelope('ty1', payload: {
        'taskId': 't1',
        'userId': 'u2',
        'isTyping': true,
      }));
      fake.fire('member.removed', {
        'eventId': 'e1',
        'occurredAt': '2026-08-15T10:00:00.000Z',
        'payload': {'teamId': 'team1', 'userId': 'u2'},
      });
      fake.fire('invitation.accepted', envelope('i1'));

      expect(routed, [
        'task:t1',
        'task:t1',
        'task:t1',
        'task:t1',
        'task:t1',
        'comment',
        'presence:u1',
        'presence:u1',
        'typing',
        'member:none',
        'invitation',
      ]);
    });

    test('drops malformed envelopes without invoking handlers', () async {
      await backend.storage.write(accessToken: 'tok-1', refreshToken: 'rt');
      var called = false;
      service.onTaskEvent = (_) => called = true;
      await service.connect();

      fake.fire('task.created', 'garbage');
      fake.fire('task.created', {'eventId': 'e', 'occurredAt': 'x'});

      expect(called, isFalse);
    });
  });

  test('sendTyping emits the typing event only while connected', () async {
    await backend.storage.write(accessToken: 'tok-1', refreshToken: 'rt');

    service.sendTyping(taskId: 't1', isTyping: true);
    expect(fake.log.where((l) => l.startsWith('emit:')), isEmpty);

    await service.connect();
    fake.fireConnect();
    service.sendTyping(taskId: 't1', isTyping: true);
    expect(fake.log, contains('emit:typing'));
  });

  test('wire error events are logged, never thrown', () async {
    await backend.storage.write(accessToken: 'tok-1', refreshToken: 'rt');
    await service.connect();
    fake.fireConnect();

    fake.fireError({'code': 'RATE_LIMITED', 'message': 'Too many events'});
    fake.fire('error', {'code': 'RATE_LIMITED', 'message': 'Too many events'});

    expect(service.isConnected, isTrue);
  });

  group('screen-scoped subscriptions', () {
    test('subscribeComment receives comment events and unsubscribes', () async {
      await backend.storage.write(accessToken: 'tok-1', refreshToken: 'rt');
      final received = <String>[];
      final unsub = service.subscribeComment((e) => received.add(e.eventId));
      await service.connect();

      fake.fire('comment.added', envelope('c1'));
      unsub();
      fake.fire('comment.added', envelope('c2'));

      expect(received, ['evt-c1']);
    });

    test('subscribeTyping receives typing events for this task', () async {
      await backend.storage.write(accessToken: 'tok-1', refreshToken: 'rt');
      final received = <String>[];
      service.subscribeTyping((e) => received.add(e.payload['userId'] as String));
      await service.connect();

      fake.fire('typing', envelope('ty1', payload: {
        'taskId': 't1',
        'userId': 'u2',
        'isTyping': true,
      }));

      expect(received, ['u2']);
    });

    test('subscribeMemberRemoved receives member.removed without an actor',
        () async {
      await backend.storage.write(accessToken: 'tok-1', refreshToken: 'rt');
      final received = <String>[];
      service.subscribeMemberRemoved(
          (e) => received.add(e.payload['teamId'] as String));
      await service.connect();

      fake.fire('member.removed', {
        'eventId': 'e1',
        'occurredAt': '2026-08-15T10:00:00.000Z',
        'payload': {'teamId': 'team1', 'userId': 'u2'},
      });

      expect(received, ['team1']);
    });

    test('coarse handler and subscribers both fire for comment events',
        () async {
      await backend.storage.write(accessToken: 'tok-1', refreshToken: 'rt');
      var coarse = 0;
      var subscribed = 0;
      service.onCommentEvent = (_) => coarse++;
      service.subscribeComment((_) => subscribed++);
      await service.connect();

      fake.fire('comment.added', envelope('c1'));

      expect(coarse, 1);
      expect(subscribed, 1);
    });
  });
}
