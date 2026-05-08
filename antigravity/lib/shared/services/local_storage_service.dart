import 'package:shared_preferences/shared_preferences.dart';
import 'package:tasko/features/todo/data/models/task_model.dart';

/// Simple SharedPreferences wrapper — Singleton so init() is only called once.
/// Call LocalStorageService().init() once in main() before runApp().
class LocalStorageService {
  static final LocalStorageService _instance = LocalStorageService._internal();
  factory LocalStorageService() => _instance;
  LocalStorageService._internal();

  static const String _tasksKey = 'tasks';

  late SharedPreferences _prefs;

  /// Must be awaited once in main() before anything else runs.
  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────

  /// Load all tasks from storage. Returns empty list if none saved yet.
  List<TaskModel> loadTasks() {
    final json = _prefs.getString(_tasksKey);
    if (json == null || json.isEmpty) return [];
    return TaskModel.decode(json);
  }

  /// Save all tasks to storage immediately.
  Future<void> saveTasks(List<TaskModel> tasks) async {
    final encoded = TaskModel.encode(tasks);
    await _prefs.setString(_tasksKey, encoded);
  }

  // ── Generic key-value (used by AuthProvider / SettingsProvider) ───────────

  String? read(String key) => _prefs.getString(key);

  Future<void> write(String key, String value) async {
    await _prefs.setString(key, value);
  }

  Future<void> delete(String key) async {
    await _prefs.remove(key);
  }

  Future<void> clear() async {
    await _prefs.clear();
  }

  bool hasKey(String key) => _prefs.containsKey(key);

  // Typed helpers used by AuthProvider
  bool? readBool(String key) => _prefs.getBool(key);
  Future<void> writeBool(String key, bool value) async {
    await _prefs.setBool(key, value);
  }
}
