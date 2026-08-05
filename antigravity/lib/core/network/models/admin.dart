import 'team.dart';

class AdminStats {
  const AdminStats({
    required this.totalUsers,
    required this.totalTeams,
    required this.totalTasks,
    required this.completedTasks,
  });

  final int totalUsers;
  final int totalTeams;
  final int totalTasks;
  final int completedTasks;

  factory AdminStats.fromJson(Map<String, dynamic> json) => AdminStats(
        totalUsers: json['totalUsers'] as int? ?? 0,
        totalTeams: json['totalTeams'] as int? ?? 0,
        totalTasks: json['totalTasks'] as int? ?? 0,
        completedTasks: json['completedTasks'] as int? ?? 0,
      );
}

class AdminUser {
  const AdminUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    required this.isEmailVerified,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String role;
  final bool isEmailVerified;
  final DateTime createdAt;
  final DateTime updatedAt;

  String get displayName => '$firstName $lastName'.trim();

  factory AdminUser.fromJson(Map<String, dynamic> json) => AdminUser(
        id: json['id'] as String,
        email: json['email'] as String,
        firstName: json['firstName'] as String,
        lastName: json['lastName'] as String,
        role: json['role'] as String? ?? 'USER',
        isEmailVerified: json['isEmailVerified'] as bool? ?? false,
        createdAt: DateTime.tryParse(json['createdAt'] as String) ??
            DateTime.now(),
        updatedAt: DateTime.tryParse(json['updatedAt'] as String) ??
            DateTime.now(),
      );
}

class AdminTeam {
  const AdminTeam({
    required this.id,
    required this.name,
    required this.ownerId,
    required this.createdAt,
    required this.updatedAt,
    required this.memberCount,
    this.description,
  });

  final String id;
  final String name;
  final String? description;
  final String ownerId;
  final int memberCount;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory AdminTeam.fromJson(Map<String, dynamic> json) => AdminTeam(
        id: json['id'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        ownerId: json['ownerId'] as String,
        memberCount: json['memberCount'] as int? ?? 0,
        createdAt: DateTime.tryParse(json['createdAt'] as String) ??
            DateTime.now(),
        updatedAt: DateTime.tryParse(json['updatedAt'] as String) ??
            DateTime.now(),
      );
}

class AdminTeamMember {
  const AdminTeamMember({
    required this.memberId,
    required this.userId,
    required this.role,
    required this.email,
    required this.firstName,
    required this.lastName,
  });

  final String memberId;
  final String userId;
  final String role;
  final String email;
  final String firstName;
  final String lastName;

  String get displayName => '$firstName $lastName'.trim();

  factory AdminTeamMember.fromJson(Map<String, dynamic> json) =>
      AdminTeamMember(
        memberId: json['memberId'] as String,
        userId: json['userId'] as String,
        role: json['role'] as String? ?? 'viewer',
        email: json['email'] as String,
        firstName: json['firstName'] as String,
        lastName: json['lastName'] as String,
      );
}

class AdminTeamDetail {
  const AdminTeamDetail({required this.team, required this.members});

  final Team team;
  final List<AdminTeamMember> members;

  factory AdminTeamDetail.fromJson(Map<String, dynamic> json) =>
      AdminTeamDetail(
        team: Team.fromJson(json['team'] as Map<String, dynamic>),
        members: (json['members'] as List<dynamic>? ?? const [])
            .map((e) => AdminTeamMember.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
