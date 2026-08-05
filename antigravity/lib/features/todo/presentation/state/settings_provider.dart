import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tasko/core/network/api_error.dart';
import 'package:tasko/core/network/app_services.dart';

/// App preferences backed by the Tasko backend with a local [SharedPreferences]
/// cache so the UI reflects the last-known state instantly and works offline.
///
/// Writes are applied locally first, then pushed to the server best-effort.
class SettingsProvider extends ChangeNotifier {
  SettingsProvider({AppServices? services})
      : _services = services ?? AppServices.instance;

  final AppServices _services;

  static const _kDarkMode = 'settings_dark_mode';
  static const _kNotifications = 'settings_notifications';
  static const _kLanguage = 'settings_language';

  bool _isDarkMode = false;
  bool _notificationsEnabled = true;
  String _language = 'en';

  bool get isDarkMode => _isDarkMode;
  bool get notificationsEnabled => _notificationsEnabled;
  String get language => _language;

  /// Loads the cached values immediately, then refreshes from the backend.
  /// A failed refresh (offline / signed out) keeps the cached values.
  Future<void> loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    _isDarkMode = prefs.getBool(_kDarkMode) ?? false;
    _notificationsEnabled = prefs.getBool(_kNotifications) ?? true;
    _language = prefs.getString(_kLanguage) ?? 'en';
    notifyListeners();

    try {
      final settings = await _services.settingsApi.get();
      _isDarkMode = settings.darkMode;
      _notificationsEnabled = settings.notificationsEnabled;
      _language = settings.language;
      notifyListeners();
    } on ApiException {
      // Signed out or offline: keep cached values.
    }
  }

  void toggleDarkMode() {
    _isDarkMode = !_isDarkMode;
    _commit();
  }

  void toggleNotifications() {
    _notificationsEnabled = !_notificationsEnabled;
    _commit();
  }

  void setLanguage(String lang) {
    _language = lang;
    _commit();
  }

  void _commit() {
    notifyListeners();
    _cache();
    _pushToBackend();
  }

  Future<void> _cache() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kDarkMode, _isDarkMode);
    await prefs.setBool(_kNotifications, _notificationsEnabled);
    await prefs.setString(_kLanguage, _language);
  }

  Future<void> _pushToBackend() async {
    try {
      await _services.settingsApi.update(
        darkMode: _isDarkMode,
        notificationsEnabled: _notificationsEnabled,
        language: _language,
      );
    } on ApiException {
      // Best-effort sync; the local cache preserves the change.
    }
  }
}
