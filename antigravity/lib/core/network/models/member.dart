class TeamMemberUser {
  const TeamMemberUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
  });

  final String id;
  final String email;
  final String firstName;
  final String lastName;

  String get displayName => '$firstName $lastName'.trim();

  factory TeamMemberUser.fromJson(Map<String, dynamic> json) => TeamMemberUser(
        id: json['id'] as String,
        email: json['email'] as String,
        firstName: json['firstName'] as String,
        lastName: json['lastName'] as String,
      );
}

class TeamMember {
  const TeamMember({
    required this.userId,
    required this.role,
    required this.joinedAt,
    required this.user,
  });

  final String userId;
  final String role; // 'owner' | 'editor' | 'viewer'
  final DateTime joinedAt;
  final TeamMemberUser user;

  bool get isOwner => role == 'owner';
  bool get canEdit => role == 'owner' || role == 'editor';

  factory TeamMember.fromJson(Map<String, dynamic> json) => TeamMember(
        userId: json['userId'] as String,
        role: json['role'] as String? ?? 'viewer',
        joinedAt: DateTime.tryParse(json['joinedAt'] as String) ??
            DateTime.now(),
        user:
            TeamMemberUser.fromJson(json['user'] as Map<String, dynamic>),
      );
}
