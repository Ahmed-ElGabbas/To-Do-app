import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/shared/services/push_service.dart';

import 'core/network/test_services.dart';

/// Injectable stand-in for the FCM plugin so the three app-lifecycle states
/// can be driven deterministically in tests.
class FakePushMessaging implements PushMessaging {
  final tokenRefreshStream = StreamController<String>.broadcast();
  final messageStream = StreamController<RemoteMessage>.broadcast();
  final openedStream = StreamController<RemoteMessage>.broadcast();

  bool permissionRequested = false;
  bool presentationOptionsSet = false;
  String? token = 'tok-1';
  RemoteMessage? initial;

  @override
  Future<void> requestPermission() async {
    permissionRequested = true;
  }

  @override
  Future<void> setForegroundPresentationOptions() async {
    presentationOptionsSet = true;
  }

  @override
  Future<String?> getToken() async => token;

  @override
  Stream<String> get onTokenRefresh => tokenRefreshStream.stream;

  @override
  Stream<RemoteMessage> get messages => messageStream.stream;

  @override
  Stream<RemoteMessage> get messageOpenedApp => openedStream.stream;

  @override
  Future<RemoteMessage?> get initialMessage async => initial;

  void dispose() {
    tokenRefreshStream.close();
    messageStream.close();
    openedStream.close();
  }
}

Map<String, dynamic> deviceJson(String token) => {
      'id': 'dev-1',
      'token': token,
      'platform': null,
      'createdAt': '2025-01-01T00:00:00.000Z',
    };

void main() {
  late FakePushMessaging fcm;
  late List<String> openedTasks;
  late PushService push;

  PushService buildPush(TestBackend backend, {RemoteMessage? initial}) {
    fcm = FakePushMessaging()..initial = initial;
    openedTasks = [];
    push = PushService(
      services: backend.services,
      pushMessaging: fcm,
      taskOpener: (taskId) async => openedTasks.add(taskId),
    );
    return push;
  }

  tearDown(() {
    fcm.dispose();
  });

  test('init requests permission, suppresses foreground presentation and '
      'defers a cold-start route until flushed', () async {
    final backend = TestBackend((options, attempt) =>
        throw StateError('no request expected'));
    push = buildPush(
      backend,
      initial: RemoteMessage(messageId: 'm0', data: {'taskId': 'task-cold'}),
    );

    await push.init();

    expect(fcm.permissionRequested, isTrue);
    expect(fcm.presentationOptionsSet, isTrue);
    expect(openedTasks, isEmpty);

    await push.flushPendingRoute();

    expect(openedTasks, ['task-cold']);
  });

  test('syncCurrentToken registers the device with POST /notifications/devices',
      () async {
    Map<String, dynamic>? captured;
    final backend = TestBackend((options, attempt) {
      captured = options.data as Map<String, dynamic>?;
      expect(options.method, 'POST');
      expect(options.path, '/notifications/devices');
      return ok(deviceJson(fcm.token!));
    });
    push = buildPush(backend);

    await push.syncCurrentToken();

    expect(captured, {'token': 'tok-1'});
  });

  test('registers refreshed tokens via the same endpoint', () async {
    final registered = <String>[];
    final backend = TestBackend((options, attempt) {
      expect(options.method, 'POST');
      expect(options.path, '/notifications/devices');
      final token = (options.data as Map<String, dynamic>)['token'] as String;
      registered.add(token);
      return ok(deviceJson(token));
    });
    push = buildPush(backend);
    await push.init();

    fcm.tokenRefreshStream.add('tok-2');
    await pumpEventQueue();

    expect(registered, ['tok-2']);
  });

  test('foreground message refreshes the feed and never navigates', () async {
    final backend = TestBackend(
        (options, attempt) => throw StateError('no request expected'));
    push = buildPush(backend);
    await push.init();
    var refreshCount = 0;
    push.onForegroundMessage = () => refreshCount++;

    fcm.messageStream.add(
      RemoteMessage(messageId: 'm1', data: {'taskId': 'task-fg'}),
    );
    await pumpEventQueue();

    expect(refreshCount, 1);
    expect(openedTasks, isEmpty);
  });

  test('background tap on the system notification opens the task', () async {
    final backend = TestBackend(
        (options, attempt) => throw StateError('no request expected'));
    push = buildPush(backend);
    await push.init();

    fcm.openedStream.add(RemoteMessage(messageId: 'm2', data: {'taskId': 'task-bg'}));
    await pumpEventQueue();

    expect(openedTasks, ['task-bg']);
  });

  test('ignores opened messages that carry no taskId', () async {
    final backend = TestBackend(
        (options, attempt) => throw StateError('no request expected'));
    push = buildPush(backend);
    await push.init();

    fcm.openedStream.add(RemoteMessage(messageId: 'm3', data: {'notificationId': 'n1'}));
    await pumpEventQueue();

    expect(openedTasks, isEmpty);
  });

  test('revokeCurrentToken deletes the device', () async {
    Map<String, dynamic>? captured;
    final backend = TestBackend((options, attempt) {
      captured = options.data as Map<String, dynamic>?;
      expect(options.method, 'DELETE');
      expect(options.path, '/notifications/devices');
      return ok(null);
    });
    push = buildPush(backend);

    await push.revokeCurrentToken();

    expect(captured, {'token': 'tok-1'});
  });

  test('registration failures are swallowed, never thrown', () async {
    final backend = TestBackend(
        (options, attempt) => failResponse('DOWN', 'boom', status: 500));
    push = buildPush(backend);

    await expectLater(push.syncCurrentToken(), completes);
    await expectLater(push.revokeCurrentToken(), completes);
  });
}
