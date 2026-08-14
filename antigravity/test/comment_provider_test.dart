import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/features/collaboration/state/comment_provider.dart';
import 'package:tasko/shared/services/analytics_service.dart';
import 'package:tasko/shared/services/realtime_service.dart';

import 'core/network/test_services.dart';

class _SpyAnalyticsTracker implements AnalyticsTracker {
  final events = <({String name, Map<String, Object>? parameters})>[];

  @override
  Future<void> logEvent(String name, {Map<String, Object>? parameters}) async {
    events.add((name: name, parameters: parameters));
  }
}

Map<String, dynamic> commentJson() => {
      'id': 'c-1',
      'taskId': 't-1',
      'userId': 'u-1',
      'body': 'Nice work',
      'createdAt': '2025-01-01T00:00:00.000Z',
      'updatedAt': '2025-01-01T00:00:00.000Z',
    };

void main() {
  test('addComment fires the comment_added analytics event on success',
      () async {
    final backend = TestBackend((options, attempt) {
      expect(options.method, 'POST');
      expect(options.path, '/tasks/t-1/comments');
      return ok(commentJson());
    });
    final tracker = _SpyAnalyticsTracker();
    AnalyticsService.instance = AnalyticsService(tracker: tracker);
    addTearDown(() => AnalyticsService.instance = null);
    final provider = CommentProvider(services: backend.services);

    final added = await provider.addComment(taskId: 't-1', body: 'Nice work');

    expect(added, isTrue);
    expect(tracker.events.single.name, 'comment_added');
  });

  test('addComment does not fire the event on failure', () async {
    final backend = TestBackend(
        (options, attempt) => failResponse('NOT_ALLOWED', 'nope', status: 403));
    final tracker = _SpyAnalyticsTracker();
    AnalyticsService.instance = AnalyticsService(tracker: tracker);
    addTearDown(() => AnalyticsService.instance = null);
    final provider = CommentProvider(services: backend.services);

    final added = await provider.addComment(taskId: 't-1', body: 'Nice work');

    expect(added, isFalse);
    expect(tracker.events, isEmpty);
  });

  group('applyRealtimeComment', () {
    RealtimeEnvelope commentEnvelope(
      Map<String, dynamic> comment, {
      String taskId = 't-1',
    }) =>
        RealtimeEnvelope(
          eventName: 'comment.added',
          eventId: 'evt',
          occurredAt: '2026-01-01T00:00:00.000Z',
          actorUserId: 'u-1',
          payload: {
            'comment': comment,
            'task': {'id': taskId, 'title': 'Task'},
          },
        );

    Future<CommentProvider> loaded() async {
      final backend = TestBackend((options, attempt) {
        expect(options.method, 'GET');
        expect(options.path, '/tasks/t-1/comments');
        return ok(<dynamic>[]);
      });
      final provider = CommentProvider(services: backend.services);
      await provider.load('t-1');
      return provider;
    }

    test('appends a live comment for the loaded task', () async {
      final provider = await loaded();
      final live = commentJson()
        ..['id'] = 'c-live'
        ..['body'] = 'Live comment';

      provider.applyRealtimeComment(commentEnvelope(live));

      expect(provider.comments.single.id, 'c-live');
      expect(provider.comments.single.body, 'Live comment');
    });

    test('ignores comments for another task', () async {
      final provider = await loaded();
      final other = commentJson()..['taskId'] = 't-2';

      provider.applyRealtimeComment(commentEnvelope(other, taskId: 't-2'));

      expect(provider.comments, isEmpty);
    });

    test('drops a duplicate id (the echo of this device own post)', () async {
      final provider = await loaded();
      final envelope = commentEnvelope(commentJson());

      provider.applyRealtimeComment(envelope);
      provider.applyRealtimeComment(envelope);

      expect(provider.comments.length, 1);
    });

    test('is a no-op before load (no task scoped)', () async {
      final backend = TestBackend((options, attempt) =>
          throw StateError('no request expected'));
      final provider = CommentProvider(services: backend.services);

      provider.applyRealtimeComment(commentEnvelope(commentJson()));

      expect(provider.comments, isEmpty);
    });
  });
}
