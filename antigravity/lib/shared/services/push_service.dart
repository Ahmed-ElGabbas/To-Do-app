import 'dart:async';
import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:tasko/core/network/api_error.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/features/todo/presentation/screens/task_details_screen.dart';

/// Thin, injectable facade over the FCM plugin so [PushService] stays unit
/// testable (the plugin cannot be constructed in tests).
abstract class PushMessaging {
  Future<void> requestPermission();

  Future<void> setForegroundPresentationOptions();

  Future<String?> getToken();

  Stream<String> get onTokenRefresh;

  Stream<RemoteMessage> get messages;

  Stream<RemoteMessage> get messageOpenedApp;

  Future<RemoteMessage?> get initialMessage;
}

/// Real FCM implementation backed by `firebase_messaging`.
class FcmPushMessaging implements PushMessaging {
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;

  @override
  Future<void> requestPermission() async {
    await _fcm.requestPermission();
  }

  @override
  Future<void> setForegroundPresentationOptions() =>
      _fcm.setForegroundNotificationPresentationOptions(
        alert: false,
        badge: false,
        sound: false,
      );

  @override
  Future<String?> getToken() => _fcm.getToken();

  @override
  Stream<String> get onTokenRefresh => _fcm.onTokenRefresh;

  @override
  Stream<RemoteMessage> get messages => FirebaseMessaging.onMessage;

  @override
  Stream<RemoteMessage> get messageOpenedApp => FirebaseMessaging.onMessageOpenedApp;

  @override
  Future<RemoteMessage?> get initialMessage => _fcm.getInitialMessage();
}

/// Opens the relevant screen for a tapped push. Defaults to fetching the task
/// and pushing [TaskDetailsScreen]; [taskOpener] can inject a spy in tests.
typedef TaskOpener = Future<void> Function(String taskId);

/// Owns the Firebase Cloud Messaging integration.
///
/// The three app-lifecycle states are handled distinctly:
/// * Foreground — no system notification is shown (there is already an in-app
///   activity feed, and Android/iOS would otherwise duplicate it). Instead
///   [onForegroundMessage] fires so the in-app feed can refresh.
/// * Background — the OS renders the notification (the backend sends an FCM
///   notification message); tapping it routes here via `onMessageOpenedApp`
///   and [TaskOpener] navigates to the task.
/// * Terminated — `getInitialMessage()` is read at startup and the route is
///   deferred via [flushPendingRoute] until the session is restored.
///
/// Device tokens are registered against the existing backend endpoint
/// `POST /notifications/devices` (see [syncCurrentToken]) and revoked on
/// logout ([revokeCurrentToken]). Every network failure is logged and
/// swallowed — push must never break the originating auth flow.
class PushService {
  PushService({
    AppServices? services,
    PushMessaging? pushMessaging,
    TaskOpener? taskOpener,
  })  : _services = services ?? AppServices.instance,
        _messaging = pushMessaging ?? FcmPushMessaging(),
        _taskOpener = taskOpener ?? _defaultTaskOpener;

  /// Set once in `main.dart`; auth hooks no-op when null (e.g. widget tests).
  static PushService? instance;

  /// Root navigator used to open screens from outside the widget tree.
  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  final AppServices _services;
  final PushMessaging _messaging;
  final TaskOpener _taskOpener;

  /// Invoked when a push arrives while the app is in the foreground so the
  /// in-app notification feed (and task list) can refresh. No system alert.
  VoidCallback? onForegroundMessage;

  RemoteMessage? _pendingRoute;

  /// Registers the FCM handlers. Call once at startup, after Firebase init.
  Future<void> init() async {
    await _messaging.requestPermission();
    await _messaging.setForegroundPresentationOptions();

    _messaging.onTokenRefresh.listen(_syncToken);

    _messaging.messages.listen((_) {
      onForegroundMessage?.call();
    });

    _messaging.messageOpenedApp.listen(_handleOpened);

    final initial = await _messaging.initialMessage;
    if (initial != null) {
      _pendingRoute = initial;
    }
  }

  /// Registers the current FCM token with `POST /notifications/devices`.
  /// Best-effort: failures never propagate to the caller.
  Future<void> syncCurrentToken() async {
    try {
      final token = await _messaging.getToken();
      if (token == null || token.isEmpty) return;
      await _syncToken(token);
    } catch (e) {
      debugPrint('PushService: failed to register device token: $e');
    }
  }

  /// Registers a (possibly refreshed) token with the backend. Best-effort.
  Future<void> _syncToken(String token) async {
    try {
      if (token.isEmpty) return;
      await _services.notificationApi.registerDevice(
        token: token,
        platform: _platformName,
      );
    } catch (e) {
      debugPrint('PushService: failed to register device token: $e');
    }
  }

  /// Revokes the current FCM token via `DELETE /notifications/devices`.
  /// Best-effort, idempotent on the backend.
  Future<void> revokeCurrentToken() async {
    try {
      final token = await _messaging.getToken();
      if (token == null || token.isEmpty) return;
      await _services.notificationApi.revokeDevice(token);
    } catch (e) {
      debugPrint('PushService: failed to revoke device token: $e');
    }
  }

  /// Consumes a cold-start (`getInitialMessage`) route after the session is
  /// restored and the main scaffold is on screen.
  Future<void> flushPendingRoute() async {
    final message = _pendingRoute;
    _pendingRoute = null;
    if (message == null) return;
    await _handleOpened(message);
  }

  Future<void> _handleOpened(RemoteMessage message) async {
    final taskId = message.data['taskId'];
    if (taskId is! String || taskId.isEmpty) return;
    try {
      await _taskOpener(taskId);
    } catch (e) {
      debugPrint('PushService: failed to open task from push: $e');
    }
  }

  static Future<void> _defaultTaskOpener(String taskId) =>
      PushService.instance?.openTask(taskId) ?? Future<void>.value();

  /// Fetches [taskId] and pushes its details screen on the root navigator.
  Future<void> openTask(String taskId) async {
    try {
      final task = await _services.taskApi.get(taskId);
      final navigator = navigatorKey.currentState;
      if (navigator == null) return;
      navigator.push(
        MaterialPageRoute(builder: (_) => TaskDetailsScreen(task: task)),
      );
    } on ApiException {
      // The task may have been deleted; a missed deep link is harmless.
    }
  }

  String? get _platformName {
    if (Platform.isAndroid) return 'android';
    if (Platform.isIOS) return 'ios';
    return null;
  }
}
