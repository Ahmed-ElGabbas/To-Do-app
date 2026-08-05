import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/core/network/models/admin.dart';
import 'package:tasko/core/network/models/analytics.dart';
import 'package:tasko/core/network/models/auth.dart';
import 'package:tasko/core/network/models/comment.dart';
import 'package:tasko/core/network/models/invitation.dart';
import 'package:tasko/core/network/models/member.dart';
import 'package:tasko/core/network/models/notification.dart';
import 'package:tasko/core/network/models/pagination.dart';
import 'package:tasko/core/network/models/search.dart';
import 'package:tasko/core/network/models/settings.dart';
import 'package:tasko/core/network/models/team.dart';
import 'package:tasko/features/todo/data/models/task_model.dart';

void main() {
  group('auth payloads', () {
    test('AuthResult parses signup/login response', () {
      final result = AuthResult.fromJson({
        'user': {
          'id': 'u1',
          'email': 'a@b.c',
          'firstName': 'A',
          'lastName': 'B',
          'role': 'USER',
          'isEmailVerified': false,
          'createdAt': '2026-08-05T10:00:00.000Z',
        },
        'tokens': {'accessToken': 'jwt', 'refreshToken': 'opaque'},
      });
      expect(result.user.displayName, 'A B');
      expect(result.user.role, 'USER');
      expect(result.tokens.accessToken, 'jwt');
      expect(result.user.createdAt.year, 2026);
    });
  });

  group('task payloads', () {
    test('TaskModel parses TaskOutput from /tasks', () {
      final task = TaskModel.fromJson({
        'id': 't1',
        'title': 'Ship feature',
        'time': '06:30 AM',
        'date': 'today',
        'isDone': false,
        'priority': 'high',
        'notes': null,
        'teamId': null,
        'categoryId': 'c1',
        'tagIds': ['x', 'y'],
        'createdAt': '2026-08-05T10:00:00.000Z',
        'updatedAt': '2026-08-05T11:00:00.000Z',
      });
      expect(task.priority, 'high');
      expect(task.categoryId, 'c1');
      expect(task.tagIds, ['x', 'y']);
      expect(task.teamId, isNull);
      expect(task.updatedAt, isNotNull);
    });

    test('PaginatedResult parses /tasks list response', () {
      final page = PaginatedResult.fromJson({
        'items': [
          {
            'id': 't1',
            'title': 'T',
            'time': '9:00PM',
            'date': '2026-08-10',
            'isDone': false,
            'priority': 'low',
            'notes': null,
            'teamId': null,
            'categoryId': null,
            'tagIds': [],
            'createdAt': '2026-08-05T10:00:00.000Z',
            'updatedAt': '2026-08-05T10:00:00.000Z',
          },
        ],
        'page': 1,
        'limit': 20,
        'total': 1,
        'totalPages': 1,
      }, TaskModel.fromJson);
      expect(page.items.single.title, 'T');
      expect(page.hasMore, isFalse);
    });
  });

  group('team payloads', () {
    test('TeamWithRole parses GET /teams item', () {
      final team = TeamWithRole.fromJson({
        'id': 'team1',
        'name': 'Design',
        'description': null,
        'ownerId': 'u1',
        'createdAt': '2026-08-01T10:00:00.000Z',
        'updatedAt': '2026-08-01T10:00:00.000Z',
        'role': 'owner',
      });
      expect(team.isOwner, isTrue);
      expect(team.canEdit, isTrue);
    });

    test('TeamMember parses nested user', () {
      final member = TeamMember.fromJson({
        'userId': 'u2',
        'role': 'editor',
        'joinedAt': '2026-08-02T10:00:00.000Z',
        'user': {
          'id': 'u2',
          'email': 'b@c.d',
          'firstName': 'B',
          'lastName': 'C',
        },
      });
      expect(member.canEdit, isTrue);
      expect(member.user.displayName, 'B C');
    });

    test('Invitation parses pending state', () {
      final invitation = Invitation.fromJson({
        'id': 'i1',
        'teamId': 'team1',
        'teamName': 'Design',
        'email': 'x@y.z',
        'role': 'viewer',
        'status': 'pending',
        'expiresAt': '2026-08-12T10:00:00.000Z',
        'createdAt': '2026-08-05T10:00:00.000Z',
      });
      expect(invitation.isPending, isTrue);
    });
  });

  group('comment payloads', () {
    test('Comment parses list item', () {
      final comment = Comment.fromJson({
        'id': 'cm1',
        'taskId': 't1',
        'userId': 'u1',
        'body': 'Looks good',
        'createdAt': '2026-08-05T10:00:00.000Z',
        'updatedAt': '2026-08-05T10:00:00.000Z',
      });
      expect(comment.body, 'Looks good');
    });
  });

  group('search payloads', () {
    test('SearchResults parses keyed groups', () {
      final results = SearchResults.fromJson({
        'query': 'ship',
        'scope': 'all',
        'page': 1,
        'limit': 20,
        'results': {
          'tasks': {
            'total': 1,
            'items': [
              {
                'type': 'task',
                'id': 't1',
                'title': 'Ship',
                'time': '10:00 AM',
                'date': 'today',
                'isDone': false,
                'priority': 'high',
                'notes': null,
                'teamId': null,
                'categoryId': null,
                'tagIds': [],
                'createdAt': '2026-08-05T10:00:00.000Z',
                'updatedAt': '2026-08-05T10:00:00.000Z',
              },
            ],
          },
          'teams': {
            'total': 1,
            'items': [
              {
                'type': 'team',
                'id': 'team1',
                'name': 'Shipping',
                'description': null,
                'ownerId': 'u1',
                'createdAt': '2026-08-01T10:00:00.000Z',
                'updatedAt': '2026-08-01T10:00:00.000Z',
              },
            ],
          },
          'categories': {'total': 0, 'items': []},
          'tags': {'total': 0, 'items': []},
        },
      });
      expect(results.tasks.items.single.title, 'Ship');
      expect(results.teams.items.single.name, 'Shipping');
      expect(results.total, 2);
    });
  });

  group('analytics payloads', () {
    test('AnalyticsSummary parses full shape', () {
      final summary = AnalyticsSummary.fromJson({
        'total': 3,
        'completed': 1,
        'pending': 2,
        'completionRate': 33.3,
        'overdue': 1,
        'byPriority': {'high': 0, 'medium': 2, 'low': 1},
        'byCategory': [
          {'categoryId': null, 'name': null, 'total': 2, 'completed': 1},
        ],
        'completionTrend': [
          {'date': '2026-07-30', 'completed': 0},
          {'date': '2026-08-05', 'completed': 1},
        ],
      });
      expect(summary.byPriority.high, 0);
      expect(summary.byCategory.single.name, isNull);
      expect(summary.completionTrend.length, 2);
      expect(summary.completionRate, 33.3);
    });
  });

  group('settings + notification payloads', () {
    test('UserSettings parses GET /settings', () {
      final settings = UserSettings.fromJson({
        'userId': 'u1',
        'darkMode': false,
        'notificationsEnabled': true,
        'language': 'en',
        'updatedAt': '2026-08-05T10:00:00.000Z',
      });
      expect(settings.language, 'en');
    });

    test('AppNotification parses task_assigned', () {
      final notification = AppNotification.fromJson({
        'id': 'n1',
        'type': 'task_assigned',
        'title': 'Task assigned',
        'body': '"X" was assigned to your team.',
        'data': {'taskId': 't1'},
        'isRead': false,
        'readAt': null,
        'createdAt': '2026-08-05T10:00:00.000Z',
      });
      expect(notification.taskId, 't1');
      expect(notification.isRead, isFalse);
    });
  });

  group('admin payloads', () {
    test('AdminStats + AdminUser parse', () {
      final stats = AdminStats.fromJson({
        'totalUsers': 10,
        'totalTeams': 2,
        'totalTasks': 50,
        'completedTasks': 30,
      });
      expect(stats.totalUsers, 10);

      final user = AdminUser.fromJson({
        'id': 'u1',
        'email': 'a@b.c',
        'firstName': 'A',
        'lastName': 'B',
        'role': 'ADMIN',
        'isEmailVerified': true,
        'createdAt': '2026-08-05T10:00:00.000Z',
        'updatedAt': '2026-08-05T10:00:00.000Z',
      });
      expect(user.role, 'ADMIN');
    });

    test('AdminTeamDetail parses team + members', () {
      final detail = AdminTeamDetail.fromJson({
        'team': {
          'id': 'team1',
          'name': 'Design',
          'description': null,
          'ownerId': 'u1',
          'createdAt': '2026-08-01T10:00:00.000Z',
          'updatedAt': '2026-08-01T10:00:00.000Z',
        },
        'members': [
          {
            'memberId': 'm1',
            'userId': 'u1',
            'role': 'owner',
            'email': 'a@b.c',
            'firstName': 'A',
            'lastName': 'B',
          },
        ],
      });
      expect(detail.members.single.role, 'owner');
      expect(detail.team.name, 'Design');
    });
  });
}
