import 'package:tasko/features/todo/domain/entities/task.dart';

abstract class TaskRepository {
  Future<List<Task>> getTasks(String email);
  Future<void> addTask(String email, Task task);
  Future<void> updateTask(String email, Task task);
  Future<void> deleteTask(String email, String id);
  Future<void> clearAllTasks(String email);
}
