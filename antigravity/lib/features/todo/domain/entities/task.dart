class Task {
  final String id;
  final String title;
  final String time;
  final String date; // "today", "tomorrow", or "YYYY-MM-DD"
  final bool isDone;
  final String priority; // "high", "medium", "low"
  final String? notes;
  final String? teamId;
  final String? categoryId;
  final List<String> tagIds;
  final DateTime createdAt;
  final DateTime? updatedAt;
  final int notificationId; // used to cancel notification on delete

  Task({
    required this.id,
    required this.title,
    required this.time,
    required this.date,
    this.isDone = false,
    this.priority = 'medium',
    this.notes,
    this.teamId,
    this.categoryId,
    List<String>? tagIds,
    DateTime? createdAt,
    this.updatedAt,
    int? notificationId,
  })  : tagIds = tagIds ?? const [],
        createdAt = createdAt ?? DateTime.now(),
        notificationId = notificationId ?? id.hashCode.abs() % 2147483647;

  Task copyWith({
    String? id,
    String? title,
    String? time,
    String? date,
    bool? isDone,
    String? priority,
    String? notes,
    String? teamId,
    String? categoryId,
    List<String>? tagIds,
    DateTime? createdAt,
    DateTime? updatedAt,
    int? notificationId,
  }) {
    return Task(
      id: id ?? this.id,
      title: title ?? this.title,
      time: time ?? this.time,
      date: date ?? this.date,
      isDone: isDone ?? this.isDone,
      priority: priority ?? this.priority,
      notes: notes ?? this.notes,
      teamId: teamId ?? this.teamId,
      categoryId: categoryId ?? this.categoryId,
      tagIds: tagIds ?? this.tagIds,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      notificationId: notificationId ?? this.notificationId,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is Task && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'Task(id: $id, title: $title, time: $time, date: $date, isDone: $isDone, priority: $priority)';
  }
}
