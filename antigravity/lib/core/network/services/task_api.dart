import '../../../features/todo/data/models/task_model.dart';
import '../api_client.dart';
import '../models/pagination.dart';

class TaskApi {
  TaskApi(this._client);

  final ApiClient _client;

  Future<TaskModel> create({
    required String title,
    required String time,
    required String date,
    String? id,
    bool isDone = false,
    String priority = 'medium',
    String? notes,
    String? categoryId,
    List<String>? tagIds,
    String? teamId,
  }) async {
    final path = teamId != null ? '/teams/$teamId/tasks' : '/tasks';
    final response = await _client.post(path, data: {
      'id': ?id,
      'title': title,
      'time': time,
      'date': date,
      if (isDone) 'isDone': isDone,
      'priority': priority,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
      'categoryId': ?categoryId,
      if (tagIds != null && tagIds.isNotEmpty) 'tagIds': tagIds,
    });
    return TaskModel.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<PaginatedResult<TaskModel>> list({
    String? teamId,
    int page = 1,
    int limit = 100,
    String? date,
    String? dateFrom,
    String? dateTo,
    String? priority,
    bool? isDone,
    String? categoryId,
    String? tagId,
    String? query,
    String sortBy = 'createdAt',
    String sortDir = 'DESC',
  }) async {
    final path = teamId != null ? '/teams/$teamId/tasks' : '/tasks';
    final response = await _client.get(path, queryParameters: {
      'page': page,
      'limit': limit,
      'date': ?date,
      'dateFrom': ?dateFrom,
      'dateTo': ?dateTo,
      'priority': ?priority,
      if (isDone != null) 'isDone': '$isDone',
      'categoryId': ?categoryId,
      'tagId': ?tagId,
      if (query != null && query.isNotEmpty) 'query': query,
      'sortBy': sortBy,
      'sortDir': sortDir,
    });
    return PaginatedResult.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
      TaskModel.fromJson,
    );
  }

  Future<TaskModel> get(String id, {String? teamId}) async {
    final path = teamId != null
        ? '/teams/$teamId/tasks/$id'
        : '/tasks/$id';
    final response = await _client.get(path);
    return TaskModel.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<TaskModel> update(
    String id, {
    String? title,
    String? time,
    String? date,
    bool? isDone,
    String? priority,
    String? notes,
    String? categoryId,
    List<String>? tagIds,
    String? teamId,
  }) async {
    final path = teamId != null
        ? '/teams/$teamId/tasks/$id'
        : '/tasks/$id';
    final response = await _client.patch(path, data: {
      'title': ?title,
      'time': ?time,
      'date': ?date,
      'isDone': ?isDone,
      'priority': ?priority,
      'notes': ?notes,
      'categoryId': ?categoryId,
      'tagIds': ?tagIds,
    });
    return TaskModel.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<TaskModel> toggleDone(String id, bool isDone, {String? teamId}) async {
    final path = teamId != null
        ? '/teams/$teamId/tasks/$id/done'
        : '/tasks/$id/done';
    final response = await _client.patch(path, data: {'isDone': isDone});
    return TaskModel.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<void> delete(String id, {String? teamId}) async {
    final path = teamId != null
        ? '/teams/$teamId/tasks/$id'
        : '/tasks/$id';
    await _client.delete(path);
  }
}
