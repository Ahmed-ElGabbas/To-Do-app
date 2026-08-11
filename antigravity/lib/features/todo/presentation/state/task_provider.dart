import 'package:flutter/material.dart';
import 'package:tasko/core/network/api_error.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/features/todo/data/models/task_model.dart';
import 'package:tasko/features/todo/domain/entities/task.dart';
import 'package:tasko/shared/services/notification_service.dart';
import 'package:tasko/shared/services/performance_service.dart';

/// ChangeNotifier for task management backed by the Tasko backend.
///
/// Mutations are optimistic: the in-memory list updates immediately and the
/// server write happens in the background. If a write fails the change is
/// rolled back and [errorMessage] is surfaced. Notification-scheduling errors
/// are intentionally swallowed (best-effort, non-fatal).
class TaskProvider extends ChangeNotifier {
  TaskProvider({AppServices? services})
      : _services = services ?? AppServices.instance;

  final AppServices _services;

  List<Task> _tasks = [];
  bool _isLoading = false;
  String? _errorMessage;

  // ── Getters ───────────────────────────────────────────────────────────────

  List<Task> get tasks => _tasks;
  List<Task> get allTasks => _tasks;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  /// Tasks with date matching today (relative or ISO format) timezone-safely
  List<Task> get todayTasks {
    final now = DateTime.now();
    final todayDate = DateTime(now.year, now.month, now.day);
    return _tasks.where((t) => _isSameDate(t.date, todayDate)).toList();
  }

  /// Tasks with date matching tomorrow (relative or ISO format) timezone-safely
  List<Task> get tomorrowTasks {
    final now = DateTime.now();
    final tomorrowDate =
        DateTime(now.year, now.month, now.day).add(const Duration(days: 1));
    return _tasks.where((t) => _isSameDate(t.date, tomorrowDate)).toList();
  }

  /// Number of completed tasks
  int get completedCount => _tasks.where((t) => t.isDone).length;

  // ── Load ──────────────────────────────────────────────────────────────────

  /// Fetches the current user's tasks. Call once at startup (inside the
  /// MultiProvider create) or on session change.
  Future<void> loadTasks() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      await PerformanceService.trace('task_list_load', () async {
        final result = await _services.taskApi.list();
        _tasks = result.items.map((m) => m as Task).toList();
      });
    } on ApiException catch (e) {
      _errorMessage = e.message;
      if (e.isUnauthorized) {
        // The session is gone; drop stale tasks rather than showing them.
        _tasks = [];
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ── Add ───────────────────────────────────────────────────────────────────

  /// Adds a task. The list updates instantly, the task is persisted on the
  /// backend, and a local notification is scheduled (best-effort).
  Future<void> addTask(Task task) async {
    final optimistic = TaskModel.fromEntity(task);
    _tasks.add(optimistic);
    _errorMessage = null;
    notifyListeners();

    try {
      final created = await _services.taskApi.create(
        id: task.id,
        title: task.title,
        time: task.time,
        date: task.date,
        isDone: task.isDone,
        priority: task.priority,
        notes: task.notes,
        categoryId: task.categoryId,
        tagIds: task.tagIds,
        teamId: task.teamId,
      );
      final index = _tasks.indexWhere((t) => t.id == task.id);
      if (index != -1) _tasks[index] = created;
      notifyListeners();
    } on ApiException catch (e) {
      _tasks.removeWhere((t) => t.id == task.id);
      _errorMessage = e.message;
      notifyListeners();
    }

    // Schedule notification (best-effort — never crashes the app)
    try {
      final scheduledTime =
          NotificationService.parseTaskDateTime(task.time, task.date);
      if (scheduledTime != null) {
        await NotificationService.scheduleTaskNotification(
          id: task.notificationId,
          title: task.title,
          scheduledTime: scheduledTime,
        );
      }
    } catch (e) {
      debugPrint('TaskProvider: failed to schedule notification for '
          '${task.id}: $e');
    }
  }

  // ── Toggle done ───────────────────────────────────────────────────────────

  Future<void> toggleDone(String id) async {
    final index = _tasks.indexWhere((t) => t.id == id);
    if (index == -1) return;
    final previous = _tasks[index];
    final updated = previous.copyWith(isDone: !previous.isDone);
    _tasks[index] = updated;
    _errorMessage = null;
    notifyListeners();

    try {
      await _services.taskApi.toggleDone(id, updated.isDone,
          teamId: previous.teamId);
    } on ApiException catch (e) {
      _tasks[index] = previous;
      _errorMessage = e.message;
      notifyListeners();
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  Future<void> deleteTask(String id) async {
    final task = _tasks.firstWhere((t) => t.id == id,
        orElse: () => throw StateError('Task $id not found'));
    _tasks.removeWhere((t) => t.id == id);
    _errorMessage = null;
    notifyListeners();

    try {
      await _services.taskApi.delete(id, teamId: task.teamId);
    } on ApiException catch (e) {
      _tasks.add(task);
      _errorMessage = e.message;
      notifyListeners();
    }
    try {
      await NotificationService.cancelNotification(task.notificationId);
    } catch (e) {
      debugPrint('TaskProvider: failed to cancel notification for '
          '${task.id}: $e');
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────

  Future<void> updateTask(Task task) async {
    final index = _tasks.indexWhere((t) => t.id == task.id);
    if (index == -1) return;
    final previous = _tasks[index];
    _tasks[index] = TaskModel.fromEntity(task);
    _errorMessage = null;
    notifyListeners();

    try {
      await _services.taskApi.update(
        task.id,
        title: task.title,
        time: task.time,
        date: task.date,
        isDone: task.isDone,
        priority: task.priority,
        notes: task.notes,
        categoryId: task.categoryId,
        tagIds: task.tagIds,
        teamId: task.teamId,
      );
    } on ApiException catch (e) {
      _tasks[index] = previous;
      _errorMessage = e.message;
      notifyListeners();
    }
  }

  // ── Clear all ─────────────────────────────────────────────────────────────

  Future<void> clearAll() async {
    final removed = List<Task>.from(_tasks);
    _tasks.clear();
    _errorMessage = null;
    notifyListeners();

    for (final task in removed) {
      try {
        await _services.taskApi.delete(task.id, teamId: task.teamId);
      } on ApiException catch (e) {
        _errorMessage = e.message;
      }
    }
    try {
      await NotificationService.cancelAll();
    } catch (e) {
      debugPrint('TaskProvider: failed to cancel all notifications: $e');
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  bool _isSameDate(String dateStr, DateTime targetDate) {
    final d = dateStr.toLowerCase().trim();
    final target = DateTime(targetDate.year, targetDate.month, targetDate.day);
    if (d == 'today') {
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      return target == today;
    }
    if (d == 'tomorrow') {
      final now = DateTime.now();
      final tomorrow =
          DateTime(now.year, now.month, now.day).add(const Duration(days: 1));
      return target == tomorrow;
    }
    try {
      final parsed = DateTime.parse(d);
      final parsedDate = DateTime(parsed.year, parsed.month, parsed.day);
      return target == parsedDate;
    } catch (e) {
      debugPrint('TaskProvider: failed to parse date string "$dateStr": $e');
      return false;
    }
  }
}
