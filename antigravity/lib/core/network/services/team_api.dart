import '../api_client.dart';
import '../models/team.dart';

class TeamApi {
  TeamApi(this._client);

  final ApiClient _client;

  Future<Team> create({
    required String name,
    String? description,
  }) async {
    final response = await _client.post('/teams', data: {
      'name': name,
      'description': ?(description != null && description.isNotEmpty ? description : null),
    });
    return Team.fromJson(_client.unwrap(response) as Map<String, dynamic>);
  }

  Future<List<TeamWithRole>> list() async {
    final response = await _client.get('/teams');
    return (_client.unwrap(response) as List<dynamic>)
        .map((e) => TeamWithRole.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Team> get(String teamId) async {
    final response = await _client.get('/teams/$teamId');
    return Team.fromJson(_client.unwrap(response) as Map<String, dynamic>);
  }

  Future<Team> update(String teamId, {String? name, String? description}) async {
    final response = await _client.patch('/teams/$teamId', data: {
      'name': ?name,
      'description': ?description,
    });
    return Team.fromJson(_client.unwrap(response) as Map<String, dynamic>);
  }

  Future<void> delete(String teamId) async {
    await _client.delete('/teams/$teamId');
  }
}
