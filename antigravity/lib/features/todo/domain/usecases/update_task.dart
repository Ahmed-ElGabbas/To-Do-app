import 'package:antigravity/features/todo/domain/entities/task.dart';
import 'package:antigravity/features/todo/domain/repositories/task_repository.dart';

class UpdateTask {
  final TaskRepository repository;

  UpdateTask(this.repository);

  Future<void> call(Task task) async {
    return repository.updateTask(task);
  }
}
