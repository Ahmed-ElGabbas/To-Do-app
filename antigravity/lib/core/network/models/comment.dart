class Comment {
  const Comment({
    required this.id,
    required this.taskId,
    required this.userId,
    required this.body,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String taskId;
  final String userId;
  final String body;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory Comment.fromJson(Map<String, dynamic> json) => Comment(
        id: json['id'] as String,
        taskId: json['taskId'] as String,
        userId: json['userId'] as String,
        body: json['body'] as String,
        createdAt: DateTime.tryParse(json['createdAt'] as String) ??
            DateTime.now(),
        updatedAt: DateTime.tryParse(json['updatedAt'] as String) ??
            DateTime.now(),
      );
}
