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

  /// Load all tasks for a specific user.
  /// Handles automatic migration of legacy global tasks to the user's isolated storage.
  List<TaskModel> loadTasksForUser(String email) {
    final userKey = email.isNotEmpty ? 'tasks_$email' : _tasksKey;

    if (email.isNotEmpty && !_prefs.containsKey(userKey)) {
      final legacyJson = _prefs.getString(_tasksKey);
      if (legacyJson != null && legacyJson.isNotEmpty) {
        _prefs.setString(userKey, legacyJson);
        _prefs.remove(_tasksKey); // clean legacy global key
        return TaskModel.decode(legacyJson);
      }
    }

    final json = _prefs.getString(userKey);
    if (json == null || json.isEmpty) return [];
    return TaskModel.decode(json);
  }

  /// Save all tasks for a specific user immediately.
  Future<void> saveTasksForUser(String email, List<TaskModel> tasks) async {
    final userKey = email.isNotEmpty ? 'tasks_$email' : _tasksKey;
    final encoded = TaskModel.encode(tasks);
    await _prefs.setString(userKey, encoded);
  }

  /// Migrate a user's stored tasks from one email key to another.
  /// Safe no-op when: old == new, the old key is absent, or the destination
  /// key already has data (existing data is never silently overwritten).
  Future<void> renameUserTasks(String oldEmail, String newEmail) async {
    if (oldEmail == newEmail) return;
    final oldKey = oldEmail.isNotEmpty ? 'tasks_$oldEmail' : _tasksKey;
    final newKey = newEmail.isNotEmpty ? 'tasks_$newEmail' : _tasksKey;
    final value = _prefs.getString(oldKey);
    if (value == null || value.isEmpty) return;
    if (_prefs.containsKey(newKey)) return;
    await _prefs.setString(newKey, value);
    await _prefs.remove(oldKey);
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
