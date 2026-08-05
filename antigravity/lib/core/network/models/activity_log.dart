class ActivityLogEntry {
  const ActivityLogEntry({
    required this.id,
    required this.type,
    required this.entityId,
    required this.summary,
    required this.createdAt,
    this.metadata,
  });

  final String id;

  /// Dot-notation event type, e.g. `task.created`, `comment.added`,
  /// `user.role.changed`.
  final String type;
  final String entityId;
  final String summary;
  final Map<String, dynamic>? metadata;
  final DateTime createdAt;

  factory ActivityLogEntry.fromJson(Map<String, dynamic> json) =>
      ActivityLogEntry(
        id: json['id'] as String,
        type: json['type'] as String,
        entityId: json['entityId'] as String,
        summary: json['summary'] as String,
        metadata: json['metadata'] as Map<String, dynamic>?,
        createdAt: DateTime.tryParse(json['createdAt'] as String) ??
            DateTime.now(),
      );
}
