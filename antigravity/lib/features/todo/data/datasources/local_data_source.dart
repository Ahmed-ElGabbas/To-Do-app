import 'package:antigravity/features/todo/data/models/task_model.dart';
import 'package:antigravity/shared/services/local_storage_service.dart';

class LocalDataSource {
  static const String _tasksKey = 'tasks';

  final LocalStorageService _storageService;

  LocalDataSource(this._storageService);

  Future<List<TaskModel>> getTasks() async {
    final tasksString = _storageService.read(_tasksKey);
    if (tasksString == null || tasksString.isEmpty) {
      return [];
    }
    return TaskModel.decode(tasksString);
  }

  Future<void> saveTasks(List<TaskModel> tasks) async {
    final encoded = TaskModel.encode(tasks);
    await _storageService.write(_tasksKey, encoded);
  }

  Future<void> addTask(TaskModel task) async {
    final tasks = await getTasks();
    tasks.add(task);
    await saveTasks(tasks);
  }

  Future<void> updateTask(TaskModel task) async {
    final tasks = await getTasks();
    final index = tasks.indexWhere((t) => t.id == task.id);
    if (index != -1) {
      tasks[index] = task;
      await saveTasks(tasks);
    }
  }

  Future<void> deleteTask(String id) async {
    final tasks = await getTasks();
    tasks.removeWhere((t) => t.id == id);
    await saveTasks(tasks);
  }
}
