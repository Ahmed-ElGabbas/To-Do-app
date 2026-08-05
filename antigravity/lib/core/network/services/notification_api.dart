import '../api_client.dart';
import '../models/notification.dart';
import '../models/pagination.dart';

class NotificationApi {
  NotificationApi(this._client);

  final ApiClient _client;

  Future<PaginatedResult<AppNotification>> list({
    int page = 1,
    int limit = 50,
    bool? isRead,
  }) async {
    final response = await _client.get('/notifications', queryParameters: {
      'page': page,
      'limit': limit,
      if (isRead != null) 'isRead': '$isRead',
    });
    return PaginatedResult.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
      AppNotification.fromJson,
    );
  }

  Future<AppNotification> markRead(String id) async {
    final response = await _client.patch('/notifications/$id/read');
    return AppNotification.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<int> readAll() async {
    final response = await _client.post('/notifications/read-all');
    final data = _client.unwrap(response) as Map<String, dynamic>;
    return data['updated'] as int? ?? 0;
  }

  Future<List<Device>> devices() async {
    final response = await _client.get('/notifications/devices');
    return (_client.unwrap(response) as List<dynamic>)
        .map((e) => Device.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Device> registerDevice({
    required String token,
    String? platform,
  }) async {
    final response = await _client.post('/notifications/devices', data: {
      'token': token,
      'platform': ?platform,
    });
    return Device.fromJson(_client.unwrap(response) as Map<String, dynamic>);
  }

  Future<void> revokeDevice(String token) async {
    await _client.delete('/notifications/devices', data: {'token': token});
  }
}
