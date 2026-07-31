import 'package:tasko/features/todo/data/datasources/local_data_source.dart';
import 'package:tasko/features/todo/data/models/task_model.dart';
import 'package:tasko/features/todo/domain/entities/task.dart';
import 'package:tasko/features/todo/domain/repositories/task_repository.dart';

class TaskRepositoryImpl implements TaskRepository {
  final LocalDataSource localDataSource;

  TaskRepositoryImpl(this.localDataSource);

  @override
  Future<List<Task>> getTasks(String email) async {
    return localDataSource.getTasks(email);
  }

  @override
  Future<void> addTask(String email, Task task) async {
    final taskModel = TaskModel.fromEntity(task);
    await localDataSource.addTask(email, taskModel);
  }

  @override
  Future<void> updateTask(String email, Task task) async {
    final taskModel = TaskModel.fromEntity(task);
    await localDataSource.updateTask(email, taskModel);
  }

  @override
  Future<void> deleteTask(String email, String id) async {
    await localDataSource.deleteTask(email, id);
  }

  @override
  Future<void> clearAllTasks(String email) async {
    await localDataSource.saveAllTasks(email, []);
  }
}
