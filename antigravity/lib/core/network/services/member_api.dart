import '../api_client.dart';
import '../models/member.dart';

class MemberApi {
  MemberApi(this._client);

  final ApiClient _client;

  Future<List<TeamMember>> list(String teamId) async {
    final response = await _client.get('/teams/$teamId/members');
    return (_client.unwrap(response) as List<dynamic>)
        .map((e) => TeamMember.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<TeamMember> add({
    required String teamId,
    required String email,
    String role = 'viewer',
  }) async {
    final response = await _client.post('/teams/$teamId/members', data: {
      'email': email,
      'role': role,
    });
    return TeamMember.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<TeamMember> changeRole({
    required String teamId,
    required String userId,
    required String role,
  }) async {
    final response = await _client.patch('/teams/$teamId/members/$userId', data: {
      'role': role,
    });
    return TeamMember.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<void> remove({
    required String teamId,
    required String userId,
  }) async {
    await _client.delete('/teams/$teamId/members/$userId');
  }
}
