import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SettingsProvider extends ChangeNotifier {
  static const _kDarkMode = 'settings_dark_mode';
  static const _kNotifications = 'settings_notifications';
  static const _kLanguage = 'settings_language';

  bool _isDarkMode = false;
  bool _notificationsEnabled = true;
  String _language = 'en';

  bool get isDarkMode => _isDarkMode;
  bool get notificationsEnabled => _notificationsEnabled;
  String get language => _language;

  Future<void> loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    _isDarkMode = prefs.getBool(_kDarkMode) ?? false;
    _notificationsEnabled = prefs.getBool(_kNotifications) ?? true;
    _language = prefs.getString(_kLanguage) ?? 'en';
    notifyListeners();
  }

  void toggleDarkMode() {
    _isDarkMode = !_isDarkMode;
    _save();
    notifyListeners();
  }

  void toggleNotifications() {
    _notificationsEnabled = !_notificationsEnabled;
    _save();
    notifyListeners();
  }

  void setLanguage(String lang) {
    _language = lang;
    _save();
    notifyListeners();
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kDarkMode, _isDarkMode);
    await prefs.setBool(_kNotifications, _notificationsEnabled);
    await prefs.setString(_kLanguage, _language);
  }
}
