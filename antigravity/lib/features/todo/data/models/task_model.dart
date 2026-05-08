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
    super.createdAt,
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
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
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
      'createdAt': createdAt.toIso8601String(),
      'notificationId': notificationId,
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
      createdAt: task.createdAt,
      notificationId: task.notificationId,
    );
  }

  static String encode(List<TaskModel> tasks) {
    return json.encode(tasks.map((t) => t.toJson()).toList());
  }

  static List<TaskModel> decode(String tasksString) {
    final List<dynamic> jsonList =
        json.decode(tasksString) as List<dynamic>;
    return jsonList
        .map((item) => TaskModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }
}
