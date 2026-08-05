import 'package:tasko/features/todo/domain/entities/task.dart';

/// Search result item that carries the full task fields plus a `type` marker.
class TaskSummary extends Task {
  TaskSummary({
    required super.id,
    required super.title,
    required super.time,
    required super.date,
    super.isDone,
    super.priority,
    super.notes,
    super.teamId,
    super.categoryId,
    super.tagIds,
    super.createdAt,
    super.updatedAt,
  });

  factory TaskSummary.fromJson(Map<String, dynamic> json) => TaskSummary(
        id: json['id'] as String,
        title: json['title'] as String,
        time: json['time'] as String,
        date: json['date'] as String,
        isDone: json['isDone'] as bool? ?? false,
        priority: json['priority'] as String? ?? 'medium',
        notes: json['notes'] as String?,
        teamId: json['teamId'] as String?,
        categoryId: json['categoryId'] as String?,
        tagIds: (json['tagIds'] as List<dynamic>? ?? const [])
            .map((e) => e as String)
            .toList(),
        createdAt: DateTime.tryParse(json['createdAt'] as String) ??
            DateTime.now(),
        updatedAt: json['updatedAt'] != null
            ? DateTime.tryParse(json['updatedAt'] as String)
            : null,
      );
}
