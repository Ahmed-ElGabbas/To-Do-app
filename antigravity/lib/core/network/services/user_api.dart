import '../api_client.dart';
import '../models/user.dart';

class UserApi {
  UserApi(this._client);

  final ApiClient _client;

  Future<UserProfile> me() async {
    final response = await _client.get('/users/me');
    return UserProfile.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<UserProfile> updateProfile({
    String? firstName,
    String? lastName,
  }) async {
    final response = await _client.patch('/users/me', data: {
      'firstName': ?firstName,
      'lastName': ?lastName,
    });
    return UserProfile.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }
}
