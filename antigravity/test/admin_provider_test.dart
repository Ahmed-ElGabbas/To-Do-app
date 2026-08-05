import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/features/collaboration/state/admin_provider.dart';

import 'core/network/test_services.dart';

Map<String, dynamic> userJson(String id, String role) => {
      'id': id,
      'email': '$id@example.com',
      'firstName': 'First',
      'lastName': id,
      'role': role,
      'isEmailVerified': true,
      'createdAt': '2025-01-01T00:00:00.000Z',
      'updatedAt': '2025-01-01T00:00:00.000Z',
    };

Map<String, dynamic> teamJson(String id) => {
      'id': id,
      'name': 'Team $id',
      'ownerId': 'user-1',
      'memberCount': 3,
      'createdAt': '2025-01-01T00:00:00.000Z',
      'updatedAt': '2025-01-01T00:00:00.000Z',
    };

void main() {
  test('loadStats fetches admin stats', () async {
    final backend = TestBackend((options, attempt) {
      expect(options.method, 'GET');
      expect(options.path, '/admin/stats');
      return ok({
        'totalUsers': 5,
        'totalTeams': 2,
        'totalTasks': 40,
        'completedTasks': 12,
      });
    });
    final provider = AdminProvider(services: backend.services);

    await provider.loadStats();

    expect(provider.stats!.totalUsers, 5);
    expect(provider.stats!.totalTasks, 40);
    expect(provider.stats!.completedTasks, 12);
  });

  test('loadUsers pages and appends results', () async {
    var calls = 0;
    final backend = TestBackend((options, attempt) {
      calls++;
      return ok({
        'items': [userJson('u$calls', 'USER')],
        'total': 2,
      });
    });
    final provider = AdminProvider(services: backend.services);

    await provider.loadUsers();
    await provider.loadUsers();

    expect(calls, 2);
    expect(provider.users, hasLength(2));
    expect(provider.hasMoreUsers, isTrue);
  });

  test('loadUsers reset replaces the previous list', () async {
    final backend = TestBackend((options, attempt) => ok({
          'items': [userJson('u1', 'USER')],
          'total': 1,
        }));
    final provider = AdminProvider(services: backend.services);
    await provider.loadUsers();
    await provider.loadUsers(reset: true);

    expect(provider.users, hasLength(1));
    expect(provider.users.single.id, 'u1');
  });

  test('updateUserRole is optimistic and sends PATCH', () async {
    RequestOptions? captured;
    final backend = TestBackend((options, attempt) {
      if (options.method == 'GET') {
        return ok({
          'items': [userJson('u1', 'USER')],
          'total': 1,
        });
      }
      expect(options.method, 'PATCH');
      expect(options.path, '/admin/users/u1');
      captured = options;
      return ok(userJson('u1', 'ADMIN'));
    });
    final provider = AdminProvider(services: backend.services);
    await provider.loadUsers();

    final updated = await provider.updateUserRole(id: 'u1', role: 'ADMIN');

    expect(updated, isTrue);
    expect(captured!.data['role'], 'ADMIN');
    expect(provider.users.single.role, 'ADMIN');
  });

  test('updateUserRole rolls back on failure', () async {
    final backend = TestBackend((options, attempt) {
      if (options.method == 'GET') {
        return ok({
          'items': [userJson('u1', 'USER')],
          'total': 1,
        });
      }
      return failResponse('NOT_ALLOWED', 'forbidden', status: 403);
    });
    final provider = AdminProvider(services: backend.services);
    await provider.loadUsers();

    final updated = await provider.updateUserRole(id: 'u1', role: 'ADMIN');

    expect(updated, isFalse);
    expect(provider.users.single.role, 'USER');
    expect(provider.errorMessage, 'forbidden');
  });

  test('loadTeams and loadTeamDetail fetch admin team views', () async {
    final backend = TestBackend((options, attempt) {
      if (options.path == '/admin/teams') {
        return ok({
          'items': [teamJson('t1')],
          'total': 1,
        });
      }
      expect(options.path, '/admin/teams/t1');
      return ok({
        'team': teamJson('t1'),
        'members': [
          {
            'memberId': 'm1',
            'userId': 'u1',
            'role': 'owner',
            'email': 'a@b.c',
            'firstName': 'Ada',
            'lastName': 'Lovelace',
          }
        ],
      });
    });
    final provider = AdminProvider(services: backend.services);

    await provider.loadTeams();
    await provider.loadTeamDetail('t1');

    expect(provider.teams.single.memberCount, 3);
    expect(provider.teamDetail!.members.single.displayName, 'Ada Lovelace');
    expect(provider.teamDetail!.team.name, 'Team t1');
  });
}
