import 'package:tasko/features/todo/domain/entities/task.dart';
import 'package:tasko/features/todo/domain/repositories/task_repository.dart';

class UpdateTask {
  final TaskRepository repository;

  UpdateTask(this.repository);

  Future<void> call(String email, Task task) async {
    return repository.updateTask(email, task);
  }
}
