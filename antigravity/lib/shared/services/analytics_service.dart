import 'dart:async';

import 'package:firebase_analytics/firebase_analytics.dart';

/// Injectable facade over Firebase Analytics so app code stays unit-testable
/// (the native plugin cannot be constructed in tests).
abstract class AnalyticsTracker {
  Future<void> logEvent(String name, {Map<String, Object>? parameters});
}

/// Real Firebase Analytics implementation.
class FirebaseAnalyticsTracker implements AnalyticsTracker {
  FirebaseAnalyticsTracker({FirebaseAnalytics? analytics})
      : _analytics = analytics ?? FirebaseAnalytics.instance;

  final FirebaseAnalytics _analytics;

  @override
  Future<void> logEvent(String name, {Map<String, Object>? parameters}) =>
      _analytics.logEvent(name: name, parameters: parameters);
}

/// Round 5 product-usage events (Section 10 of the Firebase plan).
///
/// Aggregate signal only — it must never duplicate the backend `activity_logs`
/// audit trail, and never carries content PII: no task titles, no comment
/// bodies, no search query text. The only parameters are booleans, counts, and
/// provider names. Every helper is a no-op when the service is not initialized
/// (widget tests), so providers stay testable without Firebase.
class AnalyticsService {
  AnalyticsService({AnalyticsTracker? tracker})
      : _tracker = tracker ?? FirebaseAnalyticsTracker();

  /// Set once in `main.dart`; event helpers no-op when null (widget tests).
  static AnalyticsService? instance;

  final AnalyticsTracker _tracker;

  static void taskCreated({
    required bool hasTeam,
    required bool hasCategory,
  }) {
    final service = instance;
    if (service == null) return;
    unawaited(service._tracker.logEvent('task_created', parameters: {
      'has_team': hasTeam,
      'has_category': hasCategory,
    }));
  }

  static void teamCreated() {
    final service = instance;
    if (service == null) return;
    unawaited(service._tracker.logEvent('team_created'));
  }

  static void invitationSent() {
    final service = instance;
    if (service == null) return;
    unawaited(service._tracker.logEvent('invitation_sent'));
  }

  static void invitationAccepted() {
    final service = instance;
    if (service == null) return;
    unawaited(service._tracker.logEvent('invitation_accepted'));
  }

  static void commentAdded() {
    final service = instance;
    if (service == null) return;
    unawaited(service._tracker.logEvent('comment_added'));
  }

  static void searchPerformed({required int resultCount}) {
    final service = instance;
    if (service == null) return;
    unawaited(service._tracker.logEvent('search_performed', parameters: {
      'result_count': resultCount,
    }));
  }

  static void socialLoginUsed({required String provider}) {
    final service = instance;
    if (service == null) return;
    unawaited(service._tracker.logEvent('social_login_used', parameters: {
      'provider': provider,
    }));
  }
}
