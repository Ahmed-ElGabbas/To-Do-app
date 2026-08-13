import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/features/collaboration/state/comment_provider.dart';
import 'package:tasko/shared/services/analytics_service.dart';

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
}
