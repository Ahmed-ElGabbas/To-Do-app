class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.isRead,
    required this.createdAt,
    this.data,
    this.readAt,
  });

  final String id;
  final String type; // 'task_created' | 'task_updated' | ... | 'task_assigned'
  final String title;
  final String body;
  final Map<String, dynamic>? data;
  final bool isRead;
  final DateTime? readAt;
  final DateTime createdAt;

  String? get taskId => data?['taskId'] as String?;
  String? get commentId => data?['commentId'] as String?;

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id: json['id'] as String,
        type: json['type'] as String,
        title: json['title'] as String,
        body: json['body'] as String,
        data: json['data'] as Map<String, dynamic>?,
        isRead: json['isRead'] as bool? ?? false,
        readAt: json['readAt'] != null
            ? DateTime.tryParse(json['readAt'] as String)
            : null,
        createdAt: DateTime.tryParse(json['createdAt'] as String) ??
            DateTime.now(),
      );
}

class Device {
  const Device({
    required this.id,
    required this.token,
    required this.createdAt,
    this.platform,
  });

  final String id;
  final String token;
  final String? platform; // 'android' | 'ios' | 'web' | null
  final DateTime createdAt;

  factory Device.fromJson(Map<String, dynamic> json) => Device(
        id: json['id'] as String,
        token: json['token'] as String,
        platform: json['platform'] as String?,
        createdAt: DateTime.tryParse(json['createdAt'] as String) ??
            DateTime.now(),
      );
}
