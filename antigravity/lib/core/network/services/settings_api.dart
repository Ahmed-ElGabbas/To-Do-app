import '../api_client.dart';
import '../models/settings.dart';

class SettingsApi {
  SettingsApi(this._client);

  final ApiClient _client;

  Future<UserSettings> get() async {
    final response = await _client.get('/settings');
    return UserSettings.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<UserSettings> update({
    bool? darkMode,
    bool? notificationsEnabled,
    String? language,
  }) async {
    final response = await _client.patch('/settings', data: {
      'darkMode': ?darkMode,
      'notificationsEnabled': ?notificationsEnabled,
      'language': ?language,
    });
    return UserSettings.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }
}
