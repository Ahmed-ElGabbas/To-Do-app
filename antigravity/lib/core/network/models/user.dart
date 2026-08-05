/// Full profile from the users module (`UserOutput`).
class UserProfile {
  const UserProfile({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    required this.isEmailVerified,
    required this.createdAt,
    required this.updatedAt,
    this.avatarFileId,
  });

  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String role;
  final bool isEmailVerified;
  final String? avatarFileId;
  final DateTime createdAt;
  final DateTime updatedAt;

  String get displayName => '$firstName $lastName'.trim();

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
        id: json['id'] as String,
        email: json['email'] as String,
        firstName: json['firstName'] as String,
        lastName: json['lastName'] as String,
        role: json['role'] as String? ?? 'USER',
        isEmailVerified: json['isEmailVerified'] as bool? ?? false,
        avatarFileId: json['avatarFileId'] as String?,
        createdAt: DateTime.tryParse(json['createdAt'] as String) ??
            DateTime.now(),
        updatedAt: DateTime.tryParse(json['updatedAt'] as String) ??
            DateTime.now(),
      );

  UserProfile copyWith({String? firstName, String? lastName}) => UserProfile(
        id: id,
        email: email,
        firstName: firstName ?? this.firstName,
        lastName: lastName ?? this.lastName,
        role: role,
        isEmailVerified: isEmailVerified,
        avatarFileId: avatarFileId,
        createdAt: createdAt,
        updatedAt: updatedAt,
      );
}
