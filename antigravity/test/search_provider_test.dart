import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/features/collaboration/state/search_provider.dart';
import 'package:tasko/shared/services/analytics_service.dart';
import 'package:tasko/shared/services/performance_service.dart';
import 'package:tasko/shared/services/remote_config_service.dart';

import 'core/network/test_services.dart';

class _SpyPerformanceMonitor implements PerformanceMonitor {
  final traces = <String>[];

  @override
  Future<void> trace(String name, Future<void> Function() action) async {
    traces.add(name);
    await action();
  }
}

class _SpyAnalyticsTracker implements AnalyticsTracker {
  final events = <({String name, Map<String, Object>? parameters})>[];

  @override
  Future<void> logEvent(String name, {Map<String, Object>? parameters}) async {
    events.add((name: name, parameters: parameters));
  }
}

class _FakeConfigReader implements RemoteConfigReader {
  int minLength = 1;

  @override
  Future<void> setDefaults(Map<String, dynamic> defaults) async {}

  @override
  Future<bool> fetchAndActivate() async => true;

  @override
  bool getBool(String key) => true;

  @override
  int getInt(String key) => minLength;

  @override
  String getString(String key) => '';
}

Map<String, dynamic> searchJson({int total = 0}) => {
      'query': 'milk',
      'scope': 'all',
      'page': 1,
      'limit': 20,
      'results': {
        'tasks': {'total': total, 'items': <dynamic>[]},
        'teams': {'total': 0, 'items': <dynamic>[]},
        'categories': {'total': 0, 'items': <dynamic>[]},
        'tags': {'total': 0, 'items': <dynamic>[]},
      },
    };

void main() {
  test('search runs inside the search_query performance trace', () async {
    final backend = TestBackend((options, attempt) {
      expect(options.path, '/search');
      return ok(searchJson(total: 3));
    });
    final monitor = _SpyPerformanceMonitor();
    PerformanceService.instance = PerformanceService(monitor: monitor);
    addTearDown(() => PerformanceService.instance = null);
    final provider = SearchProvider(services: backend.services);

    await provider.search('milk');

    expect(monitor.traces, ['search_query']);
    expect(provider.results?.query, 'milk');
    expect(provider.isLoading, isFalse);
  });

  test('search fires search_performed with the result count only', () async {
    final backend = TestBackend((options, attempt) {
      expect(options.path, '/search');
      return ok(searchJson(total: 7));
    });
    final tracker = _SpyAnalyticsTracker();
    AnalyticsService.instance = AnalyticsService(tracker: tracker);
    addTearDown(() => AnalyticsService.instance = null);
    final provider = SearchProvider(services: backend.services);

    await provider.search('milk');

    expect(tracker.events.single.name, 'search_performed');
    expect(tracker.events.single.parameters, {'result_count': 7});
  });

  test('empty queries skip the network and the trace', () async {
    final monitor = _SpyPerformanceMonitor();
    PerformanceService.instance = PerformanceService(monitor: monitor);
    addTearDown(() => PerformanceService.instance = null);
    final provider = SearchProvider(
        services: TestBackend(
                (options, attempt) => throw StateError('no request expected'))
            .services);

    await provider.search('   ');

    expect(monitor.traces, isEmpty);
    expect(provider.results, isNull);
  });

  test('queries shorter than the config minimum are skipped', () async {
    final reader = _FakeConfigReader()..minLength = 3;
    RemoteConfigService.instance = RemoteConfigService(reader: reader);
    addTearDown(() => RemoteConfigService.instance = null);
    final provider = SearchProvider(
        services: TestBackend(
                (options, attempt) => throw StateError('no request expected'))
            .services);

    await provider.search('ab');

    expect(provider.results, isNull);
  });
}
