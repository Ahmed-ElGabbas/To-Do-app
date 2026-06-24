import 'package:flutter/material.dart';
import 'package:tasko/features/todo/domain/entities/task.dart';
import 'package:tasko/features/todo/data/models/task_model.dart';
import 'package:tasko/shared/services/local_storage_service.dart';
import 'package:tasko/shared/services/notification_service.dart';

/// Simple ChangeNotifier for task management.
/// Talks directly to LocalStorageService — no use-case layer.
/// Errors are NOT silently swallowed — they propagate to the caller.
class TaskProvider extends ChangeNotifier {
  final _storage = LocalStorageService();

  List<Task> _tasks = [];

  // ── Getters ───────────────────────────────────────────────────────────────

  List<Task> get tasks => _tasks;
  List<Task> get allTasks => _tasks;

  /// Tasks with date matching today (relative or ISO format) timezone-safely
  List<Task> get todayTasks {
    final now = DateTime.now();
    final todayDate = DateTime(now.year, now.month, now.day);
    return _tasks.where((t) => _isSameDate(t.date, todayDate)).toList();
  }

  /// Tasks with date matching tomorrow (relative or ISO format) timezone-safely
  List<Task> get tomorrowTasks {
    final now = DateTime.now();
    final tomorrowDate = DateTime(now.year, now.month, now.day).add(const Duration(days: 1));
    return _tasks.where((t) => _isSameDate(t.date, tomorrowDate)).toList();
  }

  /// Number of completed tasks
  int get completedCount => _tasks.where((t) => t.isDone).length;

  // ── Load ──────────────────────────────────────────────────────────────────

  /// Call once at startup (inside MultiProvider create) or on session change.
  Future<void> loadTasks() async {
    final email = _storage.read('auth_email') ?? '';
    final isLoggedIn = _storage.readBool('auth_is_logged_in') ?? false;
    if (isLoggedIn && email.isNotEmpty) {
      final models = _storage.loadTasksForUser(email);
      _tasks = List<Task>.from(models);
    } else {
      _tasks = [];
    }
    notifyListeners();
  }

  // ── Add ───────────────────────────────────────────────────────────────────

  /// Adds a task.
  /// Step 1: add to in-memory list and notify → UI updates INSTANTLY.
  /// Step 2: persist to SharedPreferences.
  /// Step 3: schedule notification (best-effort).
  Future<void> addTask(Task task) async {
    // Instant UI update — happens synchronously before any await
    _tasks.add(task);
    notifyListeners();

    // Persist
    await _saveAll();

    // Schedule notification (silent fail — never crashes the app)
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
    } catch (_) {}
  }

  // ── Toggle done ───────────────────────────────────────────────────────────

  Future<void> toggleDone(String id) async {
    final index = _tasks.indexWhere((t) => t.id == id);
    if (index == -1) return;
    _tasks[index] = _tasks[index].copyWith(isDone: !_tasks[index].isDone);
    notifyListeners();
    await _saveAll();
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  Future<void> deleteTask(String id) async {
    final task = _tasks.firstWhere((t) => t.id == id,
        orElse: () => throw StateError('Task $id not found'));
    _tasks.removeWhere((t) => t.id == id);
    notifyListeners();
    await _saveAll();
    try {
      await NotificationService.cancelNotification(task.notificationId);
    } catch (_) {}
  }

  // ── Update ────────────────────────────────────────────────────────────────

  Future<void> updateTask(Task task) async {
    final index = _tasks.indexWhere((t) => t.id == task.id);
    if (index == -1) return;
    _tasks[index] = task;
    notifyListeners();
    await _saveAll();
  }

  // ── Clear all ─────────────────────────────────────────────────────────────

  Future<void> clearAll() async {
    _tasks.clear();
    notifyListeners();
    await _saveAll();
    try {
      await NotificationService.cancelAll();
    } catch (_) {}
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /// Convert all tasks to TaskModel and write to SharedPreferences.
  Future<void> _saveAll() async {
    final email = _storage.read('auth_email') ?? '';
    final models = _tasks.map(TaskModel.fromEntity).toList();ش
    await _storage.saveTasksForUser(email, models);
  }

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
      final tomorrow = DateTime(now.year, now.month, now.day).add(const Duration(days: 1));
      return target == tomorrow;
    }
    try {
      final parsed = DateTime.parse(d);
      final parsedDate = DateTime(parsed.year, parsed.month, parsed.day);
      return target == parsedDate;
    } catch (_) {
      return false;
    }
  }
}
