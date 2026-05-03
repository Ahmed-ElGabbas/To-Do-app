import 'package:flutter/material.dart';
import 'package:antigravity/features/todo/domain/entities/task.dart';
import 'package:antigravity/features/todo/domain/usecases/add_task.dart';
import 'package:antigravity/features/todo/domain/usecases/get_tasks.dart';
import 'package:antigravity/features/todo/domain/usecases/delete_task.dart';
import 'package:antigravity/features/todo/domain/usecases/update_task.dart';
import 'package:antigravity/features/todo/presentation/state/task_state.dart';
import 'package:antigravity/features/todo/data/datasources/local_data_source.dart';
import 'package:antigravity/features/todo/data/repositories/task_repository_impl.dart';
import 'package:antigravity/shared/services/local_storage_service.dart';

class TaskProvider extends ChangeNotifier {
  late final GetTasks _getTasks;
  late final AddTask _addTask;
  late final DeleteTask _deleteTask;
  late final UpdateTask _updateTask;

  List<Task> _tasks = [];
  TaskState _state = TaskState.initial;
  String _errorMessage = '';

  TaskProvider() {
    _initUseCases();
  }

  void _initUseCases() {
    final storageService = LocalStorageService();
    final localDataSource = LocalDataSource(storageService);
    final repository = TaskRepositoryImpl(localDataSource);

    _getTasks = GetTasks(repository);
    _addTask = AddTask(repository);
    _deleteTask = DeleteTask(repository);
    _updateTask = UpdateTask(repository);
  }

  // Getters
  List<Task> get tasks => _tasks;
  TaskState get state => _state;
  String get errorMessage => _errorMessage;

  List<Task> get todayTasks =>
      _tasks.where((t) => t.date.toLowerCase() == 'today').toList();

  List<Task> get tomorrowTasks =>
      _tasks.where((t) => t.date.toLowerCase() == 'tomorrow').toList();

  /// Load all tasks from local storage
  Future<void> loadTasks() async {
    _state = TaskState.loading;
    notifyListeners();

    try {
      _tasks = await _getTasks();
      _state = TaskState.loaded;
    } catch (e) {
      _state = TaskState.error;
      _errorMessage = e.toString();
    }
    notifyListeners();
  }

  /// Add a new task
  Future<void> addTask(Task task) async {
    try {
      await _addTask(task);
      _tasks.add(task);
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  /// Toggle task done status
  Future<void> toggleDone(String id) async {
    try {
      final index = _tasks.indexWhere((t) => t.id == id);
      if (index != -1) {
        final task = _tasks[index];
        final updatedTask = task.copyWith(isDone: !task.isDone);
        await _updateTask(updatedTask);
        _tasks[index] = updatedTask;
        notifyListeners();
      }
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  /// Delete a task
  Future<void> deleteTask(String id) async {
    try {
      await _deleteTask(id);
      _tasks.removeWhere((t) => t.id == id);
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  /// Update a task
  Future<void> updateTask(Task task) async {
    try {
      await _updateTask(task);
      final index = _tasks.indexWhere((t) => t.id == task.id);
      if (index != -1) {
        _tasks[index] = task;
        notifyListeners();
      }
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }
}
