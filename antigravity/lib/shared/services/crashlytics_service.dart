import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';

/// Injectable facade over Firebase Crashlytics so app code stays unit-testable
/// (the native plugin cannot be constructed in tests).
abstract class CrashReporter {
  void setUserId(String userId);

  void setActiveTeamId(String? teamId);

  void log(String message);

  void recordFlutterError(FlutterErrorDetails details);

  void recordError(Object error, StackTrace stackTrace, {required bool fatal});
}

/// Real Crashlytics-backed reporter. Context values follow the backend's
/// no-PII discipline: the user identifier is the server-side UUID (never the
/// email) and the only custom key is the active team id.
class FirebaseCrashReporter implements CrashReporter {
  FirebaseCrashReporter({FirebaseCrashlytics? crashlytics})
      : _crashlytics = crashlytics ?? FirebaseCrashlytics.instance;

  final FirebaseCrashlytics _crashlytics;

  @override
  void setUserId(String userId) {
    _crashlytics.setUserIdentifier(userId);
  }

  @override
  void setActiveTeamId(String? teamId) {
    _crashlytics.setCustomKey('active_team_id', teamId ?? 'none');
  }

  @override
  void log(String message) {
    _crashlytics.log(message);
  }

  @override
  void recordFlutterError(FlutterErrorDetails details) {
    _crashlytics.recordFlutterFatalError(details);
  }

  @override
  void recordError(Object error, StackTrace stackTrace, {required bool fatal}) {
    _crashlytics.recordError(error, stackTrace, fatal: fatal);
  }
}

/// Owns Crashlytics bootstrap and crash-context wiring.
///
/// [init] installs the `FlutterError.onError` and
/// `PlatformDispatcher.instance.onError` handlers so every unhandled error is
/// recorded as fatal. After that, auth and team providers push non-PII context
/// (user id, active team id) through the static [setUser]/[setActiveTeamId]
/// helpers, which no-op when the service is not initialized (widget tests).
class CrashlyticsService {
  CrashlyticsService({CrashReporter? reporter})
      : _reporter = reporter ?? FirebaseCrashReporter();

  /// Set once in `main.dart`; providers no-op when null (widget tests).
  static CrashlyticsService? instance;

  final CrashReporter _reporter;

  /// Installs the fatal-error handlers and makes the service available via
  /// [instance]. Call once at startup, after `Firebase.initializeApp()`.
  static Future<void> init({CrashReporter? reporter}) async {
    final service = CrashlyticsService(reporter: reporter);
    instance = service;
    service._installHandlers();
  }

  void _installHandlers() {
    FlutterError.onError = (details) => _reporter.recordFlutterError(details);

    PlatformDispatcher.instance.onError = (error, stack) {
      _reporter.recordError(error, stack, fatal: true);
      return true;
    };
  }

  /// Attaches the current user's id (never the email) to crash reports.
  static void setUser(String userId) {
    instance?._reporter.setUserId(userId);
  }

  /// Attaches the active team id to crash reports, or clears it ('none') when
  /// the user has no active team.
  static void setActiveTeamId(String? teamId) {
    instance?._reporter.setActiveTeamId(teamId);
  }

  /// Records an ad-hoc breadcrumb trail line for the next crash report.
  static void log(String message) {
    instance?._reporter.log(message);
  }
}
