class Task {
  final String id;
  final String title;
  final String time;
  final String date;
  final bool isDone;
  final String priority;
  final String? notes;

  const Task({
    required this.id,
    required this.title,
    required this.time,
    required this.date,
    this.isDone = false,
    this.priority = 'medium',
    this.notes,
  });

  Task copyWith({
    String? id,
    String? title,
    String? time,
    String? date,
    bool? isDone,
    String? priority,
    String? notes,
  }) {
    return Task(
      id: id ?? this.id,
      title: title ?? this.title,
      time: time ?? this.time,
      date: date ?? this.date,
      isDone: isDone ?? this.isDone,
      priority: priority ?? this.priority,
      notes: notes ?? this.notes,
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
