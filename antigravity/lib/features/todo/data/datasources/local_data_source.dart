import 'package:tasko/features/todo/data/models/task_model.dart';
import 'package:tasko/shared/services/local_storage_service.dart';

class LocalDataSource {
  final LocalStorageService _storageService;

  LocalDataSource(this._storageService);

  Future<List<TaskModel>> getTasks(String email) async {
    return _storageService.loadTasksForUser(email);
  }

  Future<void> saveAllTasks(String email, List<TaskModel> tasks) async {
    await _storageService.saveTasksForUser(email, tasks);
  }

  Future<void> addTask(String email, TaskModel task) async {
    final tasks = await getTasks(email);
    tasks.add(task);
    await saveAllTasks(email, tasks);
  }

  Future<void> updateTask(String email, TaskModel task) async {
    final tasks = await getTasks(email);
    final index = tasks.indexWhere((t) => t.id == task.id);
    if (index != -1) {
      tasks[index] = task;
      await saveAllTasks(email, tasks);
    }
  }

  Future<void> deleteTask(String email, String id) async {
    final tasks = await getTasks(email);
    tasks.removeWhere((t) => t.id == id);
    await saveAllTasks(email, tasks);
  }
}
