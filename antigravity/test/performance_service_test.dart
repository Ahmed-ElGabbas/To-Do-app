import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/shared/services/performance_service.dart';

class _SpyMonitor implements PerformanceMonitor {
  final traces = <String>[];

  @override
  Future<void> trace(String name, Future<void> Function() action) async {
    traces.add(name);
    await action();
  }
}

void main() {
  tearDown(() {
    PerformanceService.instance = null;
  });

  test('trace runs the action directly when the service is not initialized',
      () async {
    var ran = false;
    await PerformanceService.trace('task_list_load', () async {
      ran = true;
    });

    expect(ran, isTrue);
  });

  test('trace delegates to the monitor under the given name', () async {
    final monitor = _SpyMonitor();
    PerformanceService.instance = PerformanceService(monitor: monitor);
    var ran = false;

    await PerformanceService.trace('search_query', () async {
      ran = true;
    });

    expect(monitor.traces, ['search_query']);
    expect(ran, isTrue);
  });

  test('trace still completes when the action throws', () async {
    final monitor = _SpyMonitor();
    PerformanceService.instance = PerformanceService(monitor: monitor);

    await expectLater(
      PerformanceService.trace('avatar_upload', () async {
        throw StateError('boom');
      }),
      throwsA(isA<StateError>()),
    );

    expect(monitor.traces, ['avatar_upload']);
  });
}
