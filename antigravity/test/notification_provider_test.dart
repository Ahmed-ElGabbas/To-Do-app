import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/features/collaboration/state/notification_provider.dart';

import 'core/network/test_services.dart';

Map<String, dynamic> notificationJson(
  String id, {
  bool isRead = false,
}) =>
    {
      'id': id,
      'type': 'task_assigned',
      'title': 'Assigned',
      'body': 'You were assigned',
      'data': {'taskId': 'task-9'},
      'isRead': isRead,
      'readAt': isRead ? '2025-01-02T00:00:00.000Z' : null,
      'createdAt': '2025-01-01T00:00:00.000Z',
    };

void main() {
  test('load populates the inbox and unread count', () async {
    final backend = TestBackend((options, attempt) {
      expect(options.method, 'GET');
      expect(options.path, '/notifications');
      return ok({
        'items': [
          notificationJson('n1'),
          notificationJson('n2', isRead: true),
          notificationJson('n3'),
        ],
        'total': 3,
      });
    });
    final provider = NotificationProvider(services: backend.services);

    await provider.load();

    expect(provider.notifications, hasLength(3));
    expect(provider.unreadCount, 2);
    expect(provider.isLoaded, isTrue);
  });

  test('markRead optimistically updates and patches the backend', () async {
    RequestOptions? captured;
    final backend = TestBackend((options, attempt) {
      if (options.method == 'GET') {
        return ok({
          'items': [
            notificationJson('n1'),
            notificationJson('n2', isRead: true),
            notificationJson('n3'),
          ],
          'total': 3,
        });
      }
      expect(options.method, 'PATCH');
      expect(options.path, '/notifications/n1/read');
      captured = options;
      return ok(notificationJson('n1', isRead: true));
    });
    final provider = NotificationProvider(services: backend.services);
    await provider.load();

    await provider.markRead('n1');

    expect(provider.unreadCount, 1);
    expect(provider.notifications.first.isRead, isTrue);
    expect(captured, isNotNull);
  });

  test('markRead rolls back when the backend fails', () async {
    final backend = TestBackend((options, attempt) {
      if (options.method == 'GET') {
        return ok({
          'items': [
            notificationJson('n1'),
            notificationJson('n2', isRead: true),
            notificationJson('n3'),
          ],
          'total': 3,
        });
      }
      return failResponse('FAILED', 'boom', status: 500);
    });
    final provider = NotificationProvider(services: backend.services);
    await provider.load();

    await provider.markRead('n1');

    expect(provider.notifications.first.isRead, isFalse);
    expect(provider.unreadCount, 2);
  });

  test('markAllRead updates every notification', () async {
    RequestOptions? captured;
    final backend = TestBackend((options, attempt) {
      expect(options.method, 'POST');
      expect(options.path, '/notifications/read-all');
      captured = options;
      return ok({'updated': 3});
    });
    final provider = NotificationProvider(services: backend.services);
    await provider.load();

    await provider.markAllRead();

    expect(provider.unreadCount, 0);
    expect(captured, isNotNull);
  });

  test('load surfaces the error message', () async {
    final backend = TestBackend((options, attempt) =>
        failResponse('NOTIFICATIONS_FAILED', 'down'));
    final provider = NotificationProvider(services: backend.services);

    await provider.load();

    expect(provider.errorMessage, 'down');
    expect(provider.notifications, isEmpty);
  });
}
