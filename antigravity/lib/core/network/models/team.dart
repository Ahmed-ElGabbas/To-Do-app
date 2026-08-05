class Team {
  const Team({
    required this.id,
    required this.name,
    required this.ownerId,
    required this.createdAt,
    required this.updatedAt,
    this.description,
  });

  final String id;
  final String name;
  final String? description;
  final String ownerId;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory Team.fromJson(Map<String, dynamic> json) => Team(
        id: json['id'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        ownerId: json['ownerId'] as String,
        createdAt: DateTime.tryParse(json['createdAt'] as String) ??
            DateTime.now(),
        updatedAt: DateTime.tryParse(json['updatedAt'] as String) ??
            DateTime.now(),
      );
}

/// `GET /teams` items additionally expose the caller's role.
class TeamWithRole extends Team {
  const TeamWithRole({
    required super.id,
    required super.name,
    required super.ownerId,
    required super.createdAt,
    required super.updatedAt,
    super.description,
    required this.role,
  });

  final String role; // 'owner' | 'editor' | 'viewer'

  bool get canEdit => role == 'owner' || role == 'editor';
  bool get isOwner => role == 'owner';

  factory TeamWithRole.fromJson(Map<String, dynamic> json) => TeamWithRole(
        id: json['id'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        ownerId: json['ownerId'] as String,
        createdAt: DateTime.tryParse(json['createdAt'] as String) ??
            DateTime.now(),
        updatedAt: DateTime.tryParse(json['updatedAt'] as String) ??
            DateTime.now(),
        role: json['role'] as String? ?? 'viewer',
      );
}
