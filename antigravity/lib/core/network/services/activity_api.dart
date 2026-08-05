import '../api_client.dart';
import '../models/activity_log.dart';
import '../models/pagination.dart';

class ActivityApi {
  ActivityApi(this._client);

  final ApiClient _client;

  Future<PaginatedResult<ActivityLogEntry>> list({
    int page = 1,
    int limit = 50,
    String? type,
  }) async {
    final response = await _client.get('/users/me/activity', queryParameters: {
      'page': page,
      'limit': limit,
      'type': ?type,
    });
    return PaginatedResult.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
      ActivityLogEntry.fromJson,
    );
  }
}
