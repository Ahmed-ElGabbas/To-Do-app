import 'package:shared_preferences/shared_preferences.dart';

class LocalStorageService {
  late SharedPreferences _prefs;

  /// Initialize the SharedPreferences instance
  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  /// Read a string value by key
  String? read(String key) {
    return _prefs.getString(key);
  }

  /// Write a string value by key
  Future<void> write(String key, String value) async {
    await _prefs.setString(key, value);
  }

  /// Delete a value by key
  Future<void> delete(String key) async {
    await _prefs.remove(key);
  }

  /// Clear all stored data
  Future<void> clear() async {
    await _prefs.clear();
  }

  /// Check if a key exists
  bool hasKey(String key) {
    return _prefs.containsKey(key);
  }
}
