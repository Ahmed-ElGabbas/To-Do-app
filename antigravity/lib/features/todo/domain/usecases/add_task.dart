import 'package:tasko/features/todo/domain/entities/task.dart';
import 'package:tasko/features/todo/domain/repositories/task_repository.dart';

class AddTask {
  final TaskRepository repository;

  AddTask(this.repository);

  Future<void> call(Task task) async {
    return repository.addTask(task);
  }
}
