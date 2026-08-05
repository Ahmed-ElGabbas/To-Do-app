import '../api_client.dart';
import '../models/tag.dart';

class TagApi {
  TagApi(this._client);

  final ApiClient _client;

  Future<Tag> create({required String name, String? teamId}) async {
    final path = teamId != null ? '/teams/$teamId/tags' : '/tags';
    final response = await _client.post(path, data: {'name': name});
    return Tag.fromJson(_client.unwrap(response) as Map<String, dynamic>);
  }

  Future<List<Tag>> list({String? teamId}) async {
    final path = teamId != null ? '/teams/$teamId/tags' : '/tags';
    final response = await _client.get(path);
    return (_client.unwrap(response) as List<dynamic>)
        .map((e) => Tag.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Tag> get(String id, {String? teamId}) async {
    final path = teamId != null ? '/teams/$teamId/tags/$id' : '/tags/$id';
    final response = await _client.get(path);
    return Tag.fromJson(_client.unwrap(response) as Map<String, dynamic>);
  }

  Future<Tag> update(String id, String name, {String? teamId}) async {
    final path = teamId != null ? '/teams/$teamId/tags/$id' : '/tags/$id';
    final response = await _client.patch(path, data: {'name': name});
    return Tag.fromJson(_client.unwrap(response) as Map<String, dynamic>);
  }

  Future<void> delete(String id, {String? teamId}) async {
    final path = teamId != null ? '/teams/$teamId/tags/$id' : '/tags/$id';
    await _client.delete(path);
  }
}
