import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tasko/features/todo/data/datasources/local_data_source.dart';
import 'package:tasko/features/todo/data/models/task_model.dart';
import 'package:tasko/features/todo/data/repositories/task_repository_impl.dart';
import 'package:tasko/features/todo/domain/entities/task.dart';
import 'package:tasko/features/todo/domain/repositories/task_repository.dart';
import 'package:tasko/features/todo/presentation/state/task_provider.dart';
import 'package:tasko/shared/services/local_storage_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const email = 'user@test.com';
  var idCounter = 0;

  String fmtDate(DateTime d) {
    final y = d.year.toString().padLeft(4, '0');
    final m = d.month.toString().padLeft(2, '0');
    final day = d.day.toString().padLeft(2, '0');
    return '$y-$m-$day';
  }

  Task makeTask({String? id, String? title, String? date, bool isDone = false}) {
    return Task(
      id: id ?? 'task-${idCounter++}',
      title: title ?? 'Test task',
      time: '06:30 AM',
      date: date ?? 'today',
      isDone: isDone,
    );
  }

  Future<TaskProvider> makeProvider({bool loggedIn = true, bool reset = true}) async {
    if (reset) {
      SharedPreferences.setMockInitialValues(
        loggedIn ? {'auth_is_logged_in': true, 'auth_email': email} : {},
      );
    }
    await LocalStorageService().init();

    final dataSource = LocalDataSource(LocalStorageService());
    final repository = TaskRepositoryImpl(dataSource) as TaskRepository;
    final provider = TaskProvider(repository);
    await provider.loadTasks();
    return provider;
  }

  group('loadTasks', () {
    test('returns an empty list when no user is logged in', () async {
      final provider = await makeProvider(loggedIn: false);

      expect(provider.tasks, isEmpty);
    });

    test('loads persisted tasks for the logged-in user', () async {
      final first = await makeProvider();
      await first.addTask(makeTask(id: 'persist-1', title: 'Persisted task'));

      final second = await makeProvider(reset: false);
      expect(second.tasks, hasLength(1));
      expect(second.tasks.single.title, 'Persisted task');
    });

    test('addTask works after loading persisted tasks (regression: List<TaskModel> backing)', () async {
      final first = await makeProvider();
      await first.addTask(makeTask(id: 'persist-1', title: 'Persisted task'));

      final provider = await makeProvider(reset: false);
      expect(provider.tasks, hasLength(1));

      await provider.addTask(makeTask(id: 'new-1', title: 'New task'));

      expect(provider.tasks, hasLength(2));
      expect(provider.tasks.first.title, 'Persisted task');
      expect(provider.tasks.last.title, 'New task');
    });
  });

  group('addTask', () {
    test('adds the task to the in-memory list', () async {
      final provider = await makeProvider();

      await provider.addTask(makeTask(title: 'Buy milk'));

      expect(provider.tasks, hasLength(1));
      expect(provider.tasks.single.title, 'Buy milk');
    });

    test('persists the task under the per-user storage key', () async {
      final provider = await makeProvider();
      final task = makeTask(title: 'Persist me');

      await provider.addTask(task);

      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('tasks_$email');
      expect(raw, isNotNull);
      expect(TaskModel.decode(raw!), hasLength(1));
      expect(TaskModel.decode(raw).single.title, 'Persist me');
    });

    test('keeps the task in memory only when no user is logged in', () async {
      final provider = await makeProvider(loggedIn: false);

      await provider.addTask(makeTask(title: 'Guest task'));

      expect(provider.tasks, hasLength(1));

      final second = await makeProvider(loggedIn: false, reset: false);
      expect(second.tasks, isEmpty);
    });
  });

  group('toggleDone', () {
    test('flips completion state and persists it', () async {
      final provider = await makeProvider();
      final task = makeTask();
      await provider.addTask(task);
      expect(provider.tasks.single.isDone, isFalse);

      await provider.toggleDone(task.id);

      expect(provider.tasks.single.isDone, isTrue);
      expect(provider.completedCount, 1);

      final prefs = await SharedPreferences.getInstance();
      final decoded = TaskModel.decode(prefs.getString('tasks_$email')!);
      expect(decoded.single.isDone, isTrue);

      await provider.toggleDone(task.id);
      expect(provider.tasks.single.isDone, isFalse);
      expect(provider.completedCount, 0);
    });
  });

  group('updateTask', () {
    test('replaces the task data and persists it', () async {
      final provider = await makeProvider();
      final task = makeTask(title: 'Original');
      await provider.addTask(task);

      await provider.updateTask(task.copyWith(title: 'Updated', notes: 'note'));

      expect(provider.tasks.single.title, 'Updated');
      expect(provider.tasks.single.notes, 'note');

      final second = await makeProvider(reset: false);
      expect(second.tasks.single.title, 'Updated');
    });
  });

  group('deleteTask', () {
    test('removes the task and persists the deletion', () async {
      final provider = await makeProvider();
      final task = makeTask();
      await provider.addTask(task);

      await provider.deleteTask(task.id);

      expect(provider.tasks, isEmpty);

      final prefs = await SharedPreferences.getInstance();
      expect(TaskModel.decode(prefs.getString('tasks_$email')!), isEmpty);
    });

    test('throws StateError for an unknown id', () async {
      final provider = await makeProvider();

      expect(() => provider.deleteTask('missing'), throwsStateError);
    });
  });

  group('clearAll', () {
    test('empties the task list and persists the deletion', () async {
      final provider = await makeProvider();
      await provider.addTask(makeTask());
      await provider.addTask(makeTask());
      await provider.addTask(makeTask());

      await provider.clearAll();

      expect(provider.tasks, isEmpty);

      final prefs = await SharedPreferences.getInstance();
      expect(TaskModel.decode(prefs.getString('tasks_$email')!), isEmpty);
    });
  });

  group('filtering getters', () {
    test('todayTasks and tomorrowTasks filter by date', () async {
      final provider = await makeProvider();
      final later = DateTime.now().add(const Duration(days: 5));

      final todayTask = makeTask(id: 't-today', date: 'today');
      final tomorrowTask = makeTask(id: 't-tomorrow', date: 'tomorrow');
      final isoToday = makeTask(id: 't-iso-today', date: fmtDate(DateTime.now()));
      final isoTomorrow =
          makeTask(id: 't-iso-tomorrow', date: fmtDate(DateTime.now().add(const Duration(days: 1))));
      final isoLater = makeTask(id: 't-later', date: fmtDate(later));

      await provider.addTask(todayTask);
      await provider.addTask(tomorrowTask);
      await provider.addTask(isoToday);
      await provider.addTask(isoTomorrow);
      await provider.addTask(isoLater);

      expect(provider.todayTasks.map((t) => t.id).toSet(),
          {'t-today', 't-iso-today'});
      expect(provider.tomorrowTasks.map((t) => t.id).toSet(),
          {'t-tomorrow', 't-iso-tomorrow'});
      expect(provider.tasks.where((t) => t.id == 't-later').single.date,
          fmtDate(later));
    });

    test('completedCount counts only done tasks', () async {
      final provider = await makeProvider();
      await provider.addTask(makeTask(id: 'done', isDone: true));
      await provider.addTask(makeTask(id: 'pending'));
      await provider.addTask(makeTask(id: 'pending2'));

      expect(provider.completedCount, 1);
    });
  });
}
