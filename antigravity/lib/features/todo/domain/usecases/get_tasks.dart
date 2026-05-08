import 'package:tasko/features/todo/domain/entities/task.dart';
import 'package:tasko/features/todo/domain/repositories/task_repository.dart';

class GetTasks {
  final TaskRepository repository;

  GetTasks(this.repository);

  Future<List<Task>> call() async {
    return repository.getTasks();
  }
}
