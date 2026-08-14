import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/features/collaboration/state/team_provider.dart';
import 'package:tasko/shared/services/analytics_service.dart';
import 'package:tasko/shared/services/crashlytics_service.dart';
import 'package:tasko/shared/services/realtime_service.dart';

import 'core/network/test_services.dart';

class _SpyAnalyticsTracker implements AnalyticsTracker {
  final events = <({String name, Map<String, Object>? parameters})>[];

  @override
  Future<void> logEvent(String name, {Map<String, Object>? parameters}) async {
    events.add((name: name, parameters: parameters));
  }
}

class _SpyCrashReporter implements CrashReporter {
  final setActiveTeamIdCalls = <String?>[];

  @override
  void setUserId(String userId) {}

  @override
  void setActiveTeamId(String? teamId) => setActiveTeamIdCalls.add(teamId);

  @override
  void log(String message) {}

  @override
  void recordFlutterError(FlutterErrorDetails details) {}

  @override
  void recordError(Object error, StackTrace stackTrace,
      {required bool fatal}) {}
}

Map<String, dynamic> teamJson(String id, String name, {String role = 'owner'}) =>
    {
      'id': id,
      'name': name,
      'description': 'desc of $name',
      'ownerId': 'user-1',
      'role': role,
      'createdAt': '2025-01-01T00:00:00.000Z',
      'updatedAt': '2025-01-01T00:00:00.000Z',
    };

void main() {
  test('loadTeams populates the list and selects the first team', () async {
    final backend = TestBackend((options, attempt) {
      expect(options.method, 'GET');
      expect(options.path, '/teams');
      return ok([
        teamJson('team-1', 'Design'),
        teamJson('team-2', 'Mobile', role: 'viewer'),
      ]);
    });
    final provider = TeamProvider(services: backend.services);

    await provider.loadTeams();

    expect(provider.teams, hasLength(2));
    expect(provider.activeTeam?.name, 'Design');
    expect(provider.activeTeam?.canEdit, isTrue);
    expect(provider.errorMessage, isNull);
  });

  test('selectTeam switches the active team', () async {
    final backend = TestBackend(
        (options, attempt) => ok([teamJson('a', 'A'), teamJson('b', 'B')]));
    final provider = TeamProvider(services: backend.services);
    await provider.loadTeams();

    provider.selectTeam('b');

    expect(provider.activeTeamId, 'b');
  });

  test('active team id is attached to crash reports', () async {
    final reporter = _SpyCrashReporter();
    CrashlyticsService.instance = CrashlyticsService(reporter: reporter);
    addTearDown(() => CrashlyticsService.instance = null);
    final backend = TestBackend(
        (options, attempt) => ok([teamJson('a', 'A'), teamJson('b', 'B')]));
    final provider = TeamProvider(services: backend.services);

    await provider.loadTeams();
    provider.selectTeam('b');

    expect(reporter.setActiveTeamIdCalls, ['a', 'b']);
  });

  test('active team id is cleared when no team is selected', () async {
    final reporter = _SpyCrashReporter();
    CrashlyticsService.instance = CrashlyticsService(reporter: reporter);
    addTearDown(() => CrashlyticsService.instance = null);
    final backend = TestBackend(
        (options, attempt) => ok([teamJson('a', 'A'), teamJson('b', 'B')]));
    final provider = TeamProvider(services: backend.services);
    await provider.loadTeams();
    expect(reporter.setActiveTeamIdCalls.last, 'a');

    await provider.deleteTeam('a');
    expect(reporter.setActiveTeamIdCalls.last, 'b');

    await provider.deleteTeam('b');
    expect(reporter.setActiveTeamIdCalls.last, null);
  });

  test('loadTeams clears the active team when the list is empty', () async {
    final backend = TestBackend((options, attempt) => ok(<dynamic>[]));
    final provider = TeamProvider(services: backend.services);

    await provider.loadTeams();

    expect(provider.hasTeams, isFalse);
    expect(provider.activeTeam, isNull);
  });

  test('loadTeams surfaces the backend error message', () async {
    final backend = TestBackend((options, attempt) =>
        failResponse('TEAMS_LOAD_FAILED', 'boom'));
    final provider = TeamProvider(services: backend.services);

    await provider.loadTeams();

    expect(provider.errorMessage, 'boom');
    expect(provider.teams, isEmpty);
  });

  test('createTeam posts and selects the new team', () async {
    RequestOptions? captured;
    final backend = TestBackend((options, attempt) {
      expect(options.method, 'POST');
      expect(options.path, '/teams');
      captured = options;
      return ok({
        'id': 'team-new',
        'name': 'New',
        'description': 'x',
        'ownerId': 'user-1',
        'createdAt': '2025-01-01T00:00:00.000Z',
        'updatedAt': '2025-01-01T00:00:00.000Z',
      });
    });
    final provider = TeamProvider(services: backend.services);

    final created = await provider.createTeam(name: 'New', description: 'x');

    expect(created, isTrue);
    expect(captured!.data['name'], 'New');
    expect(provider.activeTeamId, 'team-new');
    expect(provider.activeTeam?.role, 'owner');
  });

  test('deleteTeam removes the team and reselects', () async {
    final backend = TestBackend((options, attempt) {
      expect(options.method, 'DELETE');
      expect(options.path, '/teams/team-1');
      return ok(null);
    });
    final provider = TeamProvider(services: backend.services);
    await provider.loadTeams();
    provider.selectTeam('team-1');

    final deleted = await provider.deleteTeam('team-1');

    expect(deleted, isTrue);
    expect(provider.hasTeams, isFalse);
    expect(provider.activeTeam, isNull);
  });

  test('members and invitations load through the team APIs', () async {
    final backend = TestBackend((options, attempt) {
      if (options.path == '/teams/t/members') {
        return ok([
          {
            'userId': 'u1',
            'role': 'owner',
            'joinedAt': '2025-01-01T00:00:00.000Z',
            'user': {
              'id': 'u1',
              'email': 'a@b.c',
              'firstName': 'Ada',
              'lastName': 'Lovelace',
            },
          }
        ]);
      }
      expect(options.path, '/teams/t/invitations');
      return ok([
        {
          'id': 'inv-1',
          'teamId': 't',
          'teamName': 'T',
          'email': 'inv@b.c',
          'role': 'viewer',
          'status': 'pending',
          'expiresAt': '2025-02-01T00:00:00.000Z',
          'createdAt': '2025-01-01T00:00:00.000Z',
        }
      ]);
    });
    final provider = TeamProvider(services: backend.services);

    final members = await provider.members('t');
    final invitations = await provider.invitations('t');

    expect(members.single.user.displayName, 'Ada Lovelace');
    expect(invitations.single.status, 'pending');
    expect(provider.errorMessage, isNull);
  });

  test('member mutations return false and record the error on failure',
      () async {
    final backend = TestBackend((options, attempt) =>
        failResponse('NOT_ALLOWED', 'nope', status: 403));
    final provider = TeamProvider(services: backend.services);

    final added = await provider.addMember(
      teamId: 't',
      email: 'x@b.c',
      role: 'editor',
    );

    expect(added, isFalse);
    expect(provider.errorMessage, 'nope');
  });

  test('createTeam fires the team_created analytics event', () async {
    final backend = TestBackend((options, attempt) {
      expect(options.method, 'POST');
      expect(options.path, '/teams');
      return ok({
        'id': 'team-new',
        'name': 'New',
        'description': 'x',
        'ownerId': 'user-1',
        'createdAt': '2025-01-01T00:00:00.000Z',
        'updatedAt': '2025-01-01T00:00:00.000Z',
      });
    });
    final tracker = _SpyAnalyticsTracker();
    AnalyticsService.instance = AnalyticsService(tracker: tracker);
    addTearDown(() => AnalyticsService.instance = null);
    final provider = TeamProvider(services: backend.services);

    await provider.createTeam(name: 'New', description: 'x');

    expect(tracker.events.single.name, 'team_created');
  });

  test('createInvitation fires the invitation_sent analytics event', () async {
    final backend = TestBackend((options, attempt) {
      expect(options.method, 'POST');
      expect(options.path, '/teams/t/invitations');
      return ok({
        'id': 'inv-1',
        'teamId': 't',
        'teamName': 'T',
        'email': 'inv@b.c',
        'role': 'viewer',
        'status': 'pending',
        'expiresAt': '2026-01-01T00:00:00.000Z',
        'createdAt': '2025-01-01T00:00:00.000Z',
      });
    });
    final tracker = _SpyAnalyticsTracker();
    AnalyticsService.instance = AnalyticsService(tracker: tracker);
    addTearDown(() => AnalyticsService.instance = null);
    final provider = TeamProvider(services: backend.services);

    final sent = await provider.createInvitation(
      teamId: 't',
      email: 'inv@b.c',
    );

    expect(sent, isTrue);
    expect(tracker.events.single.name, 'invitation_sent');
  });

  group('presence', () {
    RealtimeEnvelope presenceEnv(String event, String userId) =>
        RealtimeEnvelope(
          eventName: event,
          eventId: 'evt',
          occurredAt: '2026-01-01T00:00:00.000Z',
          actorUserId: 'u-1',
          payload: {'userId': userId},
        );

    test('user.online/user.offline track membership', () {
      final backend =
          TestBackend((options, attempt) => throw StateError('no request'));
      final provider = TeamProvider(services: backend.services);

      provider.applyPresence(presenceEnv('user.online', 'u1'));
      expect(provider.isOnline('u1'), isTrue);
      expect(provider.onlineUserIds, {'u1'});

      provider.applyPresence(presenceEnv('user.offline', 'u1'));
      expect(provider.isOnline('u1'), isFalse);
      expect(provider.onlineUserIds, isEmpty);
    });

    test('only notifies when the membership set actually changes', () {
      final backend =
          TestBackend((options, attempt) => throw StateError('no request'));
      final provider = TeamProvider(services: backend.services);
      var notifications = 0;
      provider.addListener(() => notifications++);

      provider.applyPresence(presenceEnv('user.online', 'u1'));
      provider.applyPresence(presenceEnv('user.online', 'u1'));
      provider.applyPresence(presenceEnv('user.offline', 'u2'));
      provider.applyPresence(presenceEnv('user.offline', 'u1'));

      expect(notifications, 2);
    });

    test('a malformed payload is ignored', () {
      final backend =
          TestBackend((options, attempt) => throw StateError('no request'));
      final provider = TeamProvider(services: backend.services);
      var notifications = 0;
      provider.addListener(() => notifications++);

      provider.applyPresence(RealtimeEnvelope(
        eventName: 'user.online',
        eventId: 'evt',
        occurredAt: '2026-01-01T00:00:00.000Z',
        actorUserId: 'u-1',
        payload: const {},
      ));

      expect(notifications, 0);
      expect(provider.onlineUserIds, isEmpty);
    });
  });
}
