import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/features/collaboration/state/activity_provider.dart';

import 'core/network/test_services.dart';

Map<String, dynamic> entryJson(String id, String type) => {
      'id': id,
      'type': type,
      'entityId': 'task-1',
      'summary': 'Created a task',
      'metadata': {'teamId': 't1'},
      'createdAt': '2025-01-01T00:00:00.000Z',
    };

void main() {
  test('load populates the activity feed', () async {
    final backend = TestBackend((options, attempt) {
      expect(options.method, 'GET');
      expect(options.path, '/users/me/activity');
      return ok({
        'items': [entryJson('a1', 'task.created'), entryJson('a2', 'team.created')],
        'total': 2,
      });
    });
    final provider = ActivityProvider(services: backend.services);

    await provider.load();

    expect(provider.entries, hasLength(2));
    expect(provider.entries.first.type, 'task.created');
    expect(provider.entries.first.summary, 'Created a task');
    expect(provider.isLoaded, isTrue);
  });

  test('load forwards the type filter and paging params', () async {
    final backend = TestBackend((options, attempt) {
      expect(options.path, '/users/me/activity');
      expect(options.queryParameters['type'], 'task.created');
      expect(options.queryParameters['page'], 2);
      expect(options.queryParameters['limit'], 25);
      return ok({'items': <dynamic>[], 'total': 0});
    });
    final provider = ActivityProvider(services: backend.services);

    await provider.load(page: 2, limit: 25, type: 'task.created');

    expect(provider.entries, isEmpty);
  });

  test('load surfaces the error message', () async {
    final backend =
        TestBackend((options, attempt) => failResponse('ACTIVITY_FAILED', 'no'));
    final provider = ActivityProvider(services: backend.services);

    await provider.load();

    expect(provider.errorMessage, 'no');
    expect(provider.entries, isEmpty);
  });
}
