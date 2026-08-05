import '../api_client.dart';
import '../models/comment.dart';

class CommentApi {
  CommentApi(this._client);

  final ApiClient _client;

  Future<List<Comment>> list(String taskId) async {
    final response = await _client.get('/tasks/$taskId/comments');
    return (_client.unwrap(response) as List<dynamic>)
        .map((e) => Comment.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Comment> create({required String taskId, required String body}) async {
    final response = await _client.post('/tasks/$taskId/comments', data: {
      'body': body,
    });
    return Comment.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<Comment> update({required String id, required String body}) async {
    final response = await _client.patch('/comments/$id', data: {'body': body});
    return Comment.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<void> delete(String id) async {
    await _client.delete('/comments/$id');
  }
}
