import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/features/todo/domain/entities/task.dart';
import 'package:tasko/features/todo/presentation/state/task_provider.dart';

import 'core/network/test_services.dart';

String iso(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// In-memory fake of the backend task endpoints. Keeps a mutable task list so
/// create/toggle/update/delete round-trips behave like the real server.
class FakeTaskBackend {
  FakeTaskBackend() {
    backend = TestBackend(_handle);
  }

  late final TestBackend backend;
  final List<Map<String, dynamic>> serverTasks = [];
  final List<String> requests = [];
  Map<String, dynamic>? lastCreateBody;
  Map<String, dynamic>? lastToggleBody;
  Map<String, dynamic>? lastUpdateBody;

  bool failList = false;
  bool failCreate = false;
  bool failToggle = false;
  bool failUpdate = false;
  bool failDelete = false;

  ResponseBody _handle(RequestOptions options, int attempt) {
    final method = options.method;
    final path = options.path;
    requests.add('$method $path');

    final isTaskRoute = path == '/tasks' ||
        RegExp(r'^/teams/[^/]+/tasks').hasMatch(path) ||
        path.startsWith('/tasks/');

    if (!isTaskRoute) {
      throw StateError('unexpected $method $path');
    }

    if (method == 'GET') {
      if (failList) {
        return failResponse('UNAUTHORIZED', 'Token expired', status: 401);
      }
      return ok({
        'page': 1,
        'limit': 100,
        'total': serverTasks.length,
        'totalPages': serverTasks.isEmpty ? 0 : 1,
        'items': serverTasks,
      });
    }

    if (method == 'POST') {
      if (failCreate) {
        return failResponse(
            'BUSINESS_VALIDATION_ERROR', 'Invalid task', status: 422);
      }
      lastCreateBody = Map<String, dynamic>.from(options.data as Map);
      final teamMatch = RegExp(r'^/teams/([^/]+)/tasks$').firstMatch(path);
      final created = {
        ...lastCreateBody!,
        'teamId': ?teamMatch?.group(1),
        'isDone': lastCreateBody!['isDone'] ?? false,
        'priority': lastCreateBody!['priority'] ?? 'medium',
        'createdAt': '2025-01-02T00:00:00.000Z',
      };
      serverTasks.add(created);
      return ok(created);
    }

    final id = _taskId(path);
    if (id == null) {
      throw StateError('unexpected $method $path');
    }

    if (path.endsWith('/done')) {
      if (failToggle) {
        return failResponse('INTERNAL_ERROR', 'boom', status: 500);
      }
      lastToggleBody = Map<String, dynamic>.from(options.data as Map);
      final idx = serverTasks.indexWhere((t) => t['id'] == id);
      if (idx != -1) {
        serverTasks[idx] = {
          ...serverTasks[idx],
          ...lastToggleBody!,
        };
      }
      return ok(serverTasks[idx]);
    }

    if (method == 'PATCH') {
      if (failUpdate) {
        return failResponse('INTERNAL_ERROR', 'boom', status: 500);
      }
      lastUpdateBody = Map<String, dynamic>.from(options.data as Map);
      final idx = serverTasks.indexWhere((t) => t['id'] == id);
      if (idx != -1) {
        serverTasks[idx] = {...serverTasks[idx], ...lastUpdateBody!};
      }
      return ok(serverTasks[idx]);
    }

    if (method == 'DELETE') {
      if (failDelete) {
        return failResponse('INTERNAL_ERROR', 'boom', status: 500);
      }
      serverTasks.removeWhere((t) => t['id'] == id);
      return ok(null);
    }

    throw StateError('unexpected $method $path');
  }

  String? _taskId(String path) {
    final withoutDone = path.replaceFirst(RegExp(r'/done$'), '');
    final match = RegExp(r'/tasks/([^/]+)$').firstMatch(withoutDone);
    return match?.group(1);
  }
}

Map<String, dynamic> taskJson({
  String id = 'task-1',
  String title = 'My task',
  String time = '10:00',
  String date = 'today',
  bool isDone = false,
  String priority = 'medium',
  String? teamId,
}) =>
    {
      'id': id,
      'title': title,
      'time': time,
      'date': date,
      'isDone': isDone,
      'priority': priority,
      'teamId': ?teamId,
      'categoryId': null,
      'tagIds': <String>[],
      'createdAt': '2025-01-01T00:00:00.000Z',
      'updatedAt': null,
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('loadTasks', () {
    test('loads tasks from the backend', () async {
      final fake = FakeTaskBackend()
        ..serverTasks.add(taskJson(id: 'a', title: 'Alpha'))
        ..serverTasks.add(taskJson(id: 'b', title: 'Beta'));
      final provider = TaskProvider(services: fake.backend.services);

      await provider.loadTasks();

      expect(provider.isLoading, isFalse);
      expect(provider.tasks.length, 2);
      expect(provider.tasks.map((t) => t.title), containsAll(['Alpha', 'Beta']));
      expect(fake.requests, ['GET /tasks']);
    });

    test('clears tasks when the session is rejected', () async {
      final fake = FakeTaskBackend()
        ..serverTasks.add(taskJson(id: 'a', title: 'Alpha'))
        ..failList = true;
      final provider = TaskProvider(services: fake.backend.services);

      await provider.loadTasks();

      expect(provider.tasks, isEmpty);
      expect(provider.errorMessage, isNotNull);
    });
  });

  group('addTask', () {
    test('adds optimistically then adopts the server task', () async {
      final fake = FakeTaskBackend();
      final provider = TaskProvider(services: fake.backend.services);
      final task = Task(
        id: 'local-1',
        title: 'New task',
        time: '09:00',
        date: 'tomorrow',
        priority: 'high',
        notes: 'note',
      );

      await provider.addTask(task);

      expect(provider.tasks.length, 1);
      expect(fake.requests, ['POST /tasks']);
      expect(fake.lastCreateBody!['id'], 'local-1');
      expect(fake.lastCreateBody!['title'], 'New task');
      expect(fake.lastCreateBody!['priority'], 'high');
      expect(provider.tasks.first.id, 'local-1');
    });

    test('rolls back when creation fails', () async {
      final fake = FakeTaskBackend()..failCreate = true;
      final provider = TaskProvider(services: fake.backend.services);

      await provider.addTask(Task(
        id: 'local-1',
        title: 'New task',
        time: '09:00',
        date: 'today',
      ));

      expect(provider.tasks, isEmpty);
      expect(provider.errorMessage, isNotNull);
    });

    test('routes to the team endpoint when the task has a teamId', () async {
      final fake = FakeTaskBackend();
      final provider = TaskProvider(services: fake.backend.services);

      await provider.addTask(Task(
        id: 'local-1',
        title: 'Team task',
        time: '09:00',
        date: 'today',
        teamId: 'team-1',
      ));

      expect(fake.requests, ['POST /teams/team-1/tasks']);
      expect(provider.tasks.single.teamId, 'team-1');
    });
  });

  group('toggleDone', () {
    test('flips completion and persists it', () async {
      final fake = FakeTaskBackend()
        ..serverTasks.add(taskJson(id: 'a', title: 'Alpha'));
      final provider = TaskProvider(services: fake.backend.services);
      await provider.loadTasks();

      await provider.toggleDone('a');

      expect(provider.tasks.first.isDone, isTrue);
      expect(fake.lastToggleBody, {'isDone': true});
      expect(fake.requests, contains('PATCH /tasks/a/done'));
    });

    test('reverts when the backend fails', () async {
      final fake = FakeTaskBackend()
        ..serverTasks.add(taskJson(id: 'a', title: 'Alpha'))
        ..failToggle = true;
      final provider = TaskProvider(services: fake.backend.services);
      await provider.loadTasks();

      await provider.toggleDone('a');

      expect(provider.tasks.first.isDone, isFalse);
      expect(provider.errorMessage, isNotNull);
    });
  });

  group('updateTask', () {
    test('replaces the task and persists the change', () async {
      final fake = FakeTaskBackend()
        ..serverTasks.add(taskJson(id: 'a', title: 'Alpha'));
      final provider = TaskProvider(services: fake.backend.services);
      await provider.loadTasks();

      final updated = provider.tasks.first.copyWith(title: 'Renamed');
      await provider.updateTask(updated);

      expect(provider.tasks.first.title, 'Renamed');
      expect(fake.lastUpdateBody!['title'], 'Renamed');
      expect(fake.requests, contains('PATCH /tasks/a'));
    });

    test('reverts when the backend fails', () async {
      final fake = FakeTaskBackend()
        ..serverTasks.add(taskJson(id: 'a', title: 'Alpha'))
        ..failUpdate = true;
      final provider = TaskProvider(services: fake.backend.services);
      await provider.loadTasks();

      await provider.updateTask(provider.tasks.first.copyWith(title: 'Renamed'));

      expect(provider.tasks.first.title, 'Alpha');
      expect(provider.errorMessage, isNotNull);
    });
  });

  group('deleteTask', () {
    test('removes the task and notifies the backend', () async {
      final fake = FakeTaskBackend()
        ..serverTasks.add(taskJson(id: 'a', title: 'Alpha'));
      final provider = TaskProvider(services: fake.backend.services);
      await provider.loadTasks();

      await provider.deleteTask('a');

      expect(provider.tasks, isEmpty);
      expect(fake.requests, contains('DELETE /tasks/a'));
    });

    test('re-adds the task when the backend fails', () async {
      final fake = FakeTaskBackend()
        ..serverTasks.add(taskJson(id: 'a', title: 'Alpha'))
        ..failDelete = true;
      final provider = TaskProvider(services: fake.backend.services);
      await provider.loadTasks();

      await provider.deleteTask('a');

      expect(provider.tasks.length, 1);
      expect(provider.tasks.first.id, 'a');
      expect(provider.errorMessage, isNotNull);
    });

    test('throws StateError for an unknown id', () async {
      final fake = FakeTaskBackend();
      final provider = TaskProvider(services: fake.backend.services);

      expect(() => provider.deleteTask('nope'), throwsStateError);
    });
  });

  group('clearAll', () {
    test('deletes every task', () async {
      final fake = FakeTaskBackend()
        ..serverTasks.add(taskJson(id: 'a', title: 'Alpha'))
        ..serverTasks.add(taskJson(id: 'b', title: 'Beta'));
      final provider = TaskProvider(services: fake.backend.services);
      await provider.loadTasks();

      await provider.clearAll();

      expect(provider.tasks, isEmpty);
      expect(fake.requests.where((r) => r.startsWith('DELETE')), hasLength(2));
    });
  });

  group('filtering getters', () {
    test('todayTasks and tomorrowTasks filter by date', () async {
      final now = DateTime.now();
      final fake = FakeTaskBackend()
        ..serverTasks.add(taskJson(id: '1', title: 'rel-today', date: 'today'))
        ..serverTasks.add(
            taskJson(id: '2', title: 'rel-tomorrow', date: 'tomorrow'))
        ..serverTasks.add(
            taskJson(id: '3', title: 'iso-today', date: iso(now)))
        ..serverTasks.add(taskJson(
            id: '4',
            title: 'iso-tomorrow',
            date: iso(now.add(const Duration(days: 1)))))
        ..serverTasks.add(taskJson(
            id: '5',
            title: 'old',
            date: iso(now.subtract(const Duration(days: 2)))));
      final provider = TaskProvider(services: fake.backend.services);
      await provider.loadTasks();

      expect(provider.todayTasks.map((t) => t.id), containsAll(['1', '3']));
      expect(provider.tomorrowTasks.map((t) => t.id), containsAll(['2', '4']));
      expect(provider.tasks.length, 5);
    });

    test('completedCount counts only done tasks', () async {
      final fake = FakeTaskBackend()
        ..serverTasks.add(taskJson(id: '1', title: 'done', isDone: true))
        ..serverTasks.add(taskJson(id: '2', title: 'open'));
      final provider = TaskProvider(services: fake.backend.services);
      await provider.loadTasks();

      expect(provider.completedCount, 1);
    });
  });
}
