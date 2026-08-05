import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tasko/features/todo/presentation/state/settings_provider.dart';

import 'core/network/test_services.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('loadSettings reads the backend', () async {
    SharedPreferences.setMockInitialValues({});
    final backend = TestBackend((options, attempt) {
      expect(options.method, 'GET');
      expect(options.path, '/settings');
      return ok({
        'userId': 'user-1',
        'darkMode': true,
        'notificationsEnabled': false,
        'language': 'fr',
        'updatedAt': '2025-01-01T00:00:00.000Z',
      });
    });
    final provider = SettingsProvider(services: backend.services);

    await provider.loadSettings();

    expect(provider.isDarkMode, isTrue);
    expect(provider.notificationsEnabled, isFalse);
    expect(provider.language, 'fr');
  });

  test('loadSettings keeps cached values when the backend is unavailable',
      () async {
    SharedPreferences.setMockInitialValues({
      'settings_dark_mode': true,
      'settings_language': 'ar',
    });
    final backend = TestBackend((options, attempt) =>
        failResponse('UNAUTHORIZED', 'expired', status: 401));
    final provider = SettingsProvider(services: backend.services);

    await provider.loadSettings();

    expect(provider.isDarkMode, isTrue);
    expect(provider.language, 'ar');
  });

  test('mutations update locally and sync to the backend', () async {
    SharedPreferences.setMockInitialValues({});
    RequestOptions? captured;
    final backend = TestBackend((options, attempt) {
      captured = options;
      return ok({
        'userId': 'user-1',
        'darkMode': false,
        'notificationsEnabled': true,
        'language': 'en',
        'updatedAt': '2025-01-01T00:00:00.000Z',
      });
    });
    final provider = SettingsProvider(services: backend.services);
    await provider.loadSettings();

    provider.toggleDarkMode();
    await pumpEventQueue();

    expect(captured!.method, 'PATCH');
    expect(captured!.path, '/settings');
    expect(captured!.data, {
      'darkMode': true,
      'notificationsEnabled': true,
      'language': 'en',
    });
    expect(provider.isDarkMode, isTrue);
  });
}
