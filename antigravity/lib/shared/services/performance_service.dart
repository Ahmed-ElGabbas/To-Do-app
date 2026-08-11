import 'package:firebase_performance/firebase_performance.dart';

/// Injectable facade over Firebase Performance so providers stay unit-testable
/// (the native plugin cannot be constructed in tests).
abstract class PerformanceMonitor {
  Future<void> trace(String name, Future<void> Function() action);
}

/// Real Firebase Performance implementation. Creates a named trace around the
/// [action], stopping it even when the action throws so timings are always
/// flushed.
class FirebasePerformanceMonitor implements PerformanceMonitor {
  @override
  Future<void> trace(String name, Future<void> Function() action) async {
    final trace = FirebasePerformance.instance.newTrace(name);
    trace.start();
    try {
      await action();
    } finally {
      trace.stop();
    }
  }
}

/// Owns Firebase Performance custom traces around expensive user flows
/// (task-list load, search round-trip, avatar upload). The static [trace]
/// helper runs [action] directly when the service is not initialized, so
/// providers stay no-op in widget tests.
class PerformanceService {
  PerformanceService({PerformanceMonitor? monitor})
      : _monitor = monitor ?? FirebasePerformanceMonitor();

  /// Set once in `main.dart`; [trace] no-ops when null (widget tests).
  static PerformanceService? instance;

  final PerformanceMonitor _monitor;

  /// Runs [action] inside a named trace when initialized, otherwise directly.
  static Future<void> trace(
    String name,
    Future<void> Function() action,
  ) async {
    final service = instance;
    if (service == null) {
      await action();
      return;
    }
    await service._monitor.trace(name, action);
  }
}
