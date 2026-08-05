import '../api_client.dart';
import '../models/invitation.dart';

class InvitationApi {
  InvitationApi(this._client);

  final ApiClient _client;

  Future<Invitation> create({
    required String teamId,
    required String email,
    String role = 'viewer',
  }) async {
    final response = await _client.post('/teams/$teamId/invitations', data: {
      'email': email,
      'role': role,
    });
    return Invitation.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<List<Invitation>> list(String teamId) async {
    final response = await _client.get('/teams/$teamId/invitations');
    return (_client.unwrap(response) as List<dynamic>)
        .map((e) => Invitation.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> revoke({required String teamId, required String id}) async {
    await _client.delete('/teams/$teamId/invitations/$id');
  }

  Future<Invitation> getByToken(String token) async {
    final response = await _client.get('/invitations/$token');
    return Invitation.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<Invitation> accept({
    required String token,
    String? firstName,
    String? lastName,
  }) async {
    final response = await _client.post('/invitations/$token/accept', data: {
      'firstName': ?firstName,
      'lastName': ?lastName,
    });
    return Invitation.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<void> decline(String token) async {
    await _client.post('/invitations/$token/decline');
  }
}
