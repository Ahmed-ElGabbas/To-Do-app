import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/features/collaboration/state/analytics_provider.dart';

import 'core/network/test_services.dart';

Map<String, dynamic> summaryJson() => {
      'total': 10,
      'completed': 4,
      'pending': 6,
      'completionRate': 0.4,
      'overdue': 2,
      'byPriority': {'high': 3, 'medium': 5, 'low': 2},
      'byCategory': [
        {'categoryId': 'c1', 'name': 'Work', 'total': 6, 'completed': 2},
      ],
      'completionTrend': [
        {'date': '2025-01-01', 'completed': 1},
        {'date': '2025-01-02', 'completed': 3},
      ],
    };

void main() {
  test('load fetches the personal analytics', () async {
    final backend = TestBackend((options, attempt) {
      expect(options.method, 'GET');
      expect(options.path, '/analytics');
      return ok(summaryJson());
    });
    final provider = AnalyticsProvider(services: backend.services);

    await provider.load();

    expect(provider.summary, isNotNull);
    expect(provider.summary!.total, 10);
    expect(provider.summary!.completionRate, 0.4);
    expect(provider.summary!.byPriority.high, 3);
    expect(provider.summary!.completionTrend, hasLength(2));
    expect(provider.errorMessage, isNull);
  });

  test('load routes through the team analytics path when a team is active',
      () async {
    final backend = TestBackend((options, attempt) {
      expect(options.path, '/teams/team-x/analytics');
      return ok(summaryJson());
    });
    final provider = AnalyticsProvider(services: backend.services);

    await provider.load(teamId: 'team-x');

    expect(provider.summary!.total, 10);
  });

  test('load surfaces the error message', () async {
    final backend = TestBackend(
        (options, attempt) => failResponse('ANALYTICS_FAILED', 'no data'));
    final provider = AnalyticsProvider(services: backend.services);

    await provider.load();

    expect(provider.errorMessage, 'no data');
    expect(provider.summary, isNull);
  });
}
