import 'package:tasko/features/todo/domain/repositories/task_repository.dart';

class DeleteTask {
  final TaskRepository repository;

  DeleteTask(this.repository);

  Future<void> call(String email, String id) async {
    return repository.deleteTask(email, id);
  }
}
