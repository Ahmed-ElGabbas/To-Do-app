class Tag {
  const Tag({
    required this.id,
    required this.name,
    required this.createdAt,
    required this.updatedAt,
    this.teamId,
  });

  final String id;
  final String name;
  final String? teamId;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory Tag.fromJson(Map<String, dynamic> json) => Tag(
        id: json['id'] as String,
        name: json['name'] as String,
        teamId: json['teamId'] as String?,
        createdAt: DateTime.tryParse(json['createdAt'] as String) ??
            DateTime.now(),
        updatedAt: DateTime.tryParse(json['updatedAt'] as String) ??
            DateTime.now(),
      );
}
