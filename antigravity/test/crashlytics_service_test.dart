import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/shared/services/crashlytics_service.dart';

class _SpyReporter implements CrashReporter {
  final setUserIdCalls = <String>[];
  final setActiveTeamIdCalls = <String?>[];
  final logs = <String>[];
  final flutterErrors = <FlutterErrorDetails>[];
  final recordedErrors = <Object>[];

  @override
  void setUserId(String userId) => setUserIdCalls.add(userId);

  @override
  void setActiveTeamId(String? teamId) => setActiveTeamIdCalls.add(teamId);

  @override
  void log(String message) => logs.add(message);

  @override
  void recordFlutterError(FlutterErrorDetails details) =>
      flutterErrors.add(details);

  @override
  void recordError(Object error, StackTrace stackTrace, {required bool fatal}) =>
      recordedErrors.add(error);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late FlutterExceptionHandler? savedFlutterError;
  late bool Function(Object, StackTrace)? savedPlatformError;

  setUp(() {
    savedFlutterError = FlutterError.onError;
    savedPlatformError = PlatformDispatcher.instance.onError;
  });

  tearDown(() {
    CrashlyticsService.instance = null;
    FlutterError.onError = savedFlutterError;
    PlatformDispatcher.instance.onError = savedPlatformError;
  });

  test('context helpers are no-ops when the service is not initialized', () {
    CrashlyticsService.setUser('user-1');
    CrashlyticsService.setActiveTeamId('team-1');
    CrashlyticsService.log('breadcrumb');
  });

  test('init installs a FlutterError handler that records fatal errors',
      () async {
    final reporter = _SpyReporter();
    await CrashlyticsService.init(reporter: reporter);

    final details = FlutterErrorDetails(
      exception: StateError('boom'),
      stack: StackTrace.current,
      library: 'test',
    );
    FlutterError.onError!(details);

    expect(reporter.flutterErrors, hasLength(1));
  });

  test('init installs a PlatformDispatcher handler that records and swallows',
      () async {
    final reporter = _SpyReporter();
    await CrashlyticsService.init(reporter: reporter);

    final handled =
        PlatformDispatcher.instance.onError!(StateError('native'), StackTrace.current);

    expect(handled, isTrue);
    expect(reporter.recordedErrors, hasLength(1));
  });

  test('setUser/setActiveTeamId/log delegate to the reporter', () async {
    final reporter = _SpyReporter();
    await CrashlyticsService.init(reporter: reporter);

    CrashlyticsService.setUser('user-42');
    CrashlyticsService.setActiveTeamId('team-7');
    CrashlyticsService.setActiveTeamId(null);
    CrashlyticsService.log('a breadcrumb');

    expect(reporter.setUserIdCalls, ['user-42']);
    expect(reporter.setActiveTeamIdCalls, ['team-7', null]);
    expect(reporter.logs, ['a breadcrumb']);
  });
}
