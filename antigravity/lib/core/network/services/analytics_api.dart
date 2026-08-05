import '../api_client.dart';
import '../models/analytics.dart';

class AnalyticsApi {
  AnalyticsApi(this._client);

  final ApiClient _client;

  Future<AnalyticsSummary> get({String? teamId}) async {
    final path = teamId != null ? '/teams/$teamId/analytics' : '/analytics';
    final response = await _client.get(path);
    return AnalyticsSummary.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }
}
