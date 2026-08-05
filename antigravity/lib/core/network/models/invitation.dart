class Invitation {
  const Invitation({
    required this.id,
    required this.teamId,
    required this.teamName,
    required this.email,
    required this.role,
    required this.status,
    required this.expiresAt,
    required this.createdAt,
  });

  final String id;
  final String teamId;
  final String teamName;
  final String email;
  final String role; // 'owner' | 'editor' | 'viewer'
  final String status; // 'pending' | 'accepted' | 'declined' | 'revoked'
  final DateTime expiresAt;
  final DateTime createdAt;

  bool get isPending => status == 'pending';

  factory Invitation.fromJson(Map<String, dynamic> json) => Invitation(
        id: json['id'] as String,
        teamId: json['teamId'] as String,
        teamName: json['teamName'] as String,
        email: json['email'] as String,
        role: json['role'] as String? ?? 'viewer',
        status: json['status'] as String? ?? 'pending',
        expiresAt: DateTime.tryParse(json['expiresAt'] as String) ??
            DateTime.now(),
        createdAt: DateTime.tryParse(json['createdAt'] as String) ??
            DateTime.now(),
      );
}
