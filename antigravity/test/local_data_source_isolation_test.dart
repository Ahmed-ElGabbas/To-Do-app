import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tasko/features/todo/data/datasources/local_data_source.dart';
import 'package:tasko/features/todo/data/models/task_model.dart';
import 'package:tasko/shared/services/local_storage_service.dart';

void main() {
  late LocalDataSource dataSource;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    LocalStorageService().init();
    dataSource = LocalDataSource(LocalStorageService());
  });

  Future<void> seedTasks(
      String email, List<TaskModel> tasks) async {
    await dataSource.saveAllTasks(email, tasks);
  }

  group('per-user isolation', () {
    test('tasks saved under one email are not visible under another', () async {
      final taskA = TaskModel(
        id: '1',
        title: 'User A task',
        time: '10:00',
        date: 'today',
      );
      final taskB = TaskModel(
        id: '2',
        title: 'User B task',
        time: '11:00',
        date: 'tomorrow',
      );

      await seedTasks('a@x.com', [taskA]);
      await seedTasks('b@y.com', [taskB]);

      final tasksA = await dataSource.getTasks('a@x.com');
      final tasksB = await dataSource.getTasks('b@y.com');

      expect(tasksA.length, 1);
      expect(tasksA[0].title, 'User A task');

      expect(tasksB.length, 1);
      expect(tasksB[0].title, 'User B task');
    });

    test('each user sees only their own tasks after multiple saves', () async {
      final task1 = TaskModel(
        id: '1', title: 'Task 1', time: '09:00', date: 'today');
      final task2 = TaskModel(
        id: '2', title: 'Task 2', time: '10:00', date: 'today');

      await seedTasks('user@test.com', [task1, task2]);

      final tasks = await dataSource.getTasks('user@test.com');
      expect(tasks.length, 2);

      final otherTasks = await dataSource.getTasks('other@test.com');
      expect(otherTasks.length, 0);
    });

    test('empty email does not throw and returns empty list when no data',
        () async {
      final tasks = await dataSource.getTasks('');
      expect(tasks, isA<List<TaskModel>>());
      expect(tasks, isEmpty);
    });

    test('empty email falls back to global key storage', () async {
      final task = TaskModel(
        id: '1', title: 'Legacy task', time: '12:00', date: 'today');

      await seedTasks('', [task]);

      final tasks = await dataSource.getTasks('');
      expect(tasks.length, 1);
      expect(tasks[0].title, 'Legacy task');
    });

    test('addTask and deleteTask respect per-user isolation', () async {
      final task = TaskModel(
        id: '1', title: 'Isolated', time: '14:00', date: 'today');

      await dataSource.addTask('user@test.com', task);

      final userTasks = await dataSource.getTasks('user@test.com');
      expect(userTasks.length, 1);

      final otherTasks = await dataSource.getTasks('other@test.com');
      expect(otherTasks.length, 0);

      await dataSource.deleteTask('user@test.com', '1');
      final afterDelete = await dataSource.getTasks('user@test.com');
      expect(afterDelete, isEmpty);
    });

    test('updateTask respects per-user isolation', () async {
      final task = TaskModel(
        id: '1', title: 'Original', time: '15:00', date: 'today');

      await dataSource.addTask('user@test.com', task);

      final updated = TaskModel(
        id: '1', title: 'Updated', time: '16:00', date: 'tomorrow');

      await dataSource.updateTask('user@test.com', updated);

      final tasks = await dataSource.getTasks('user@test.com');
      expect(tasks.length, 1);
      expect(tasks[0].title, 'Updated');
    });
  });

  group('renameUserTasks', () {
    late LocalStorageService storage;

    setUp(() {
      storage = LocalStorageService();
    });

    test('migrates data from old key to new key and removes old', () async {
      final task = TaskModel(
        id: '1', title: 'Migrate me', time: '09:00', date: 'today');
      await storage.saveTasksForUser('old@x.com', [task]);

      await storage.renameUserTasks('old@x.com', 'new@x.com');

      final migrated = storage.loadTasksForUser('new@x.com');
      expect(migrated.length, 1);
      expect(migrated[0].title, 'Migrate me');

      expect(storage.loadTasksForUser('old@x.com'), isEmpty,
          reason: 'old key should be gone after migration');

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('tasks_old@x.com'), isNull);
      expect(prefs.getString('tasks_new@x.com'), isNotNull);
    });

    test('no-op when the old key is absent', () async {
      await storage.renameUserTasks('ghost@x.com', 'new@x.com');

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('tasks_ghost@x.com'), isNull);
      expect(prefs.getString('tasks_new@x.com'), isNull);
      expect(storage.loadTasksForUser('new@x.com'), isEmpty);
    });

    test('no-op when emails are identical', () async {
      final task = TaskModel(
        id: '1', title: 'Keep me', time: '09:00', date: 'today');
      await storage.saveTasksForUser('same@x.com', [task]);

      await storage.renameUserTasks('same@x.com', 'same@x.com');

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('tasks_same@x.com'), isNotNull);
      expect(storage.loadTasksForUser('same@x.com').length, 1);
    });

    test('does not overwrite an existing destination key', () async {
      final taskA = TaskModel(
        id: '1', title: 'Old user task', time: '09:00', date: 'today');
      final taskB = TaskModel(
        id: '2', title: 'New user task', time: '10:00', date: 'today');
      await storage.saveTasksForUser('old@x.com', [taskA]);
      await storage.saveTasksForUser('new@x.com', [taskB]);

      await storage.renameUserTasks('old@x.com', 'new@x.com');

      final destination = storage.loadTasksForUser('new@x.com');
      expect(destination.length, 1);
      expect(destination[0].title, 'New user task',
          reason: 'existing destination data is never overwritten');

      final source = storage.loadTasksForUser('old@x.com');
      expect(source.length, 1);
      expect(source[0].title, 'Old user task',
          reason: 'source data is preserved when the destination is occupied');
    });
  });
}
