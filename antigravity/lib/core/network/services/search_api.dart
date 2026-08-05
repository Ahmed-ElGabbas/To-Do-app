import '../api_client.dart';
import '../models/search.dart';

class SearchApi {
  SearchApi(this._client);

  final ApiClient _client;

  Future<SearchResults> search({
    required String q,
    String scope = 'all',
    String? teamId,
    int page = 1,
    int limit = 20,
  }) async {
    final response = await _client.get('/search', queryParameters: {
      'q': q,
      'scope': scope,
      'teamId': ?teamId,
      'page': page,
      'limit': limit,
    });
    return SearchResults.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }
}
