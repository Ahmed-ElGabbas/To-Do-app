import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/shared/services/analytics_service.dart';

class _SpyTracker implements AnalyticsTracker {
  final events = <({String name, Map<String, Object>? parameters})>[];

  @override
  Future<void> logEvent(String name, {Map<String, Object>? parameters}) async {
    events.add((name: name, parameters: parameters));
  }
}

void main() {
  tearDown(() {
    AnalyticsService.instance = null;
  });

  test('event helpers are no-ops when the service is not initialized', () {
    AnalyticsService.taskCreated(hasTeam: true, hasCategory: false);
    AnalyticsService.teamCreated();
    AnalyticsService.invitationSent();
    AnalyticsService.invitationAccepted();
    AnalyticsService.commentAdded();
    AnalyticsService.searchPerformed(resultCount: 3);
    AnalyticsService.socialLoginUsed(provider: 'google');
  });

  test('task_created carries has_team and has_category', () {
    final tracker = _SpyTracker();
    AnalyticsService.instance = AnalyticsService(tracker: tracker);

    AnalyticsService.taskCreated(hasTeam: true, hasCategory: false);

    expect(tracker.events, hasLength(1));
    expect(tracker.events.single.name, 'task_created');
    expect(tracker.events.single.parameters, {
      'has_team': true,
      'has_category': false,
    });
  });

  test('team_created, invitation_sent, invitation_accepted and comment_added '
      'log their name only', () {
    final tracker = _SpyTracker();
    AnalyticsService.instance = AnalyticsService(tracker: tracker);

    AnalyticsService.teamCreated();
    AnalyticsService.invitationSent();
    AnalyticsService.invitationAccepted();
    AnalyticsService.commentAdded();

    expect(tracker.events.map((e) => e.name).toList(), [
      'team_created',
      'invitation_sent',
      'invitation_accepted',
      'comment_added',
    ]);
    expect(tracker.events.every((e) => e.parameters == null), isTrue);
  });

  test('search_performed carries only the result count', () {
    final tracker = _SpyTracker();
    AnalyticsService.instance = AnalyticsService(tracker: tracker);

    AnalyticsService.searchPerformed(resultCount: 42);

    expect(tracker.events.single.name, 'search_performed');
    expect(tracker.events.single.parameters, {'result_count': 42});
  });

  test('social_login_used carries the provider name', () {
    final tracker = _SpyTracker();
    AnalyticsService.instance = AnalyticsService(tracker: tracker);

    AnalyticsService.socialLoginUsed(provider: 'facebook');

    expect(tracker.events.single.name, 'social_login_used');
    expect(tracker.events.single.parameters, {'provider': 'facebook'});
  });
}
