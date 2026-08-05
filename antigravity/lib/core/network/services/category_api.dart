import '../api_client.dart';
import '../models/category.dart';

class CategoryApi {
  CategoryApi(this._client);

  final ApiClient _client;

  Future<Category> create({
    required String name,
    String? teamId,
  }) async {
    final path = teamId != null
        ? '/teams/$teamId/categories'
        : '/categories';
    final response = await _client.post(path, data: {'name': name});
    return Category.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<List<Category>> list({String? teamId}) async {
    final path = teamId != null
        ? '/teams/$teamId/categories'
        : '/categories';
    final response = await _client.get(path);
    return (_client.unwrap(response) as List<dynamic>)
        .map((e) => Category.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Category> get(String id, {String? teamId}) async {
    final path = teamId != null
        ? '/teams/$teamId/categories/$id'
        : '/categories/$id';
    final response = await _client.get(path);
    return Category.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<Category> update(String id, String name, {String? teamId}) async {
    final path = teamId != null
        ? '/teams/$teamId/categories/$id'
        : '/categories/$id';
    final response = await _client.patch(path, data: {'name': name});
    return Category.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<void> delete(String id, {String? teamId}) async {
    final path = teamId != null
        ? '/teams/$teamId/categories/$id'
        : '/categories/$id';
    await _client.delete(path);
  }
}
