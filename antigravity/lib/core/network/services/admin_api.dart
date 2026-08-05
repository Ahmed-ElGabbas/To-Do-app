import '../api_client.dart';
import '../models/admin.dart';
import '../models/pagination.dart';

class AdminApi {
  AdminApi(this._client);

  final ApiClient _client;

  Future<AdminStats> stats() async {
    final response = await _client.get('/admin/stats');
    return AdminStats.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<PaginatedResult<AdminUser>> users({
    int page = 1,
    int limit = 20,
    String? q,
  }) async {
    final response = await _client.get('/admin/users', queryParameters: {
      'page': page,
      'limit': limit,
      if (q != null && q.isNotEmpty) 'q': q,
    });
    return PaginatedResult.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
      AdminUser.fromJson,
    );
  }

  Future<AdminUser> getUser(String id) async {
    final response = await _client.get('/admin/users/$id');
    return AdminUser.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<AdminUser> updateUserRole({
    required String id,
    required String role,
  }) async {
    final response = await _client.patch('/admin/users/$id', data: {'role': role});
    return AdminUser.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<PaginatedResult<AdminTeam>> teams({
    int page = 1,
    int limit = 20,
    String? q,
  }) async {
    final response = await _client.get('/admin/teams', queryParameters: {
      'page': page,
      'limit': limit,
      if (q != null && q.isNotEmpty) 'q': q,
    });
    return PaginatedResult.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
      AdminTeam.fromJson,
    );
  }

  Future<AdminTeamDetail> getTeam(String id) async {
    final response = await _client.get('/admin/teams/$id');
    return AdminTeamDetail.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }
}
