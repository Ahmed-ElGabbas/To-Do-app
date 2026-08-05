import 'dart:convert';
import 'package:tasko/features/todo/domain/entities/task.dart';

class TaskModel extends Task {
  TaskModel({
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
    super.notificationId,
  });

  factory TaskModel.fromJson(Map<String, dynamic> json) {
    return TaskModel(
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
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'] as String)
          : null,
      notificationId: json['notificationId'] as int?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'time': time,
      'date': date,
      'isDone': isDone,
      'priority': priority,
      'notes': notes,
      'teamId': teamId,
      'categoryId': categoryId,
      'tagIds': tagIds,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
      'notificationId': notificationId,
    };
  }

  /// Serializes the fields the backend accepts for task creation/update
  /// (`CreateTaskDto` / `UpdateTaskDto`). The client may supply its own
  /// `id` for idempotent optimistic creation.
  Map<String, dynamic> toCreatePayload({bool includeId = false}) {
    return {
      if (includeId) 'id': id,
      'title': title,
      'time': time,
      'date': date,
      if (isDone) 'isDone': isDone,
      'priority': priority,
      if (notes != null) 'notes': notes,
      if (categoryId != null) 'categoryId': categoryId,
      if (tagIds.isNotEmpty) 'tagIds': tagIds,
    };
  }

  factory TaskModel.fromEntity(Task task) {
    return TaskModel(
      id: task.id,
      title: task.title,
      time: task.time,
      date: task.date,
      isDone: task.isDone,
      priority: task.priority,
      notes: task.notes,
      teamId: task.teamId,
      categoryId: task.categoryId,
      tagIds: task.tagIds,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      notificationId: task.notificationId,
    );
  }

  static String encode(List<TaskModel> tasks) {
    return json.encode(tasks.map((t) => t.toJson()).toList());
  }

  static List<TaskModel> decode(String tasksString) {
    final List<dynamic> jsonList = json.decode(tasksString) as List<dynamic>;
    return jsonList
        .map((item) => TaskModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }
}
