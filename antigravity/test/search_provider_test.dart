import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/features/collaboration/state/search_provider.dart';
import 'package:tasko/shared/services/performance_service.dart';

import 'core/network/test_services.dart';

class _SpyPerformanceMonitor implements PerformanceMonitor {
  final traces = <String>[];

  @override
  Future<void> trace(String name, Future<void> Function() action) async {
    traces.add(name);
    await action();
  }
}

void main() {
  test('search runs inside the search_query performance trace', () async {
    final backend = TestBackend((options, attempt) {
      expect(options.path, '/search');
      return ok({
        'query': 'milk',
        'scope': 'all',
        'page': 1,
        'limit': 20,
        'results': {
          'tasks': {'total': 0, 'items': <dynamic>[]},
          'teams': {'total': 0, 'items': <dynamic>[]},
          'categories': {'total': 0, 'items': <dynamic>[]},
          'tags': {'total': 0, 'items': <dynamic>[]},
        },
      });
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
}
