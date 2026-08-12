/// Token pair issued on signup/login and rotation (refresh).
class AuthTokens {
  const AuthTokens({required this.accessToken, required this.refreshToken});

  final String accessToken;
  final String refreshToken;

  factory AuthTokens.fromJson(Map<String, dynamic> json) => AuthTokens(
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
      );
}

/// Public user payload from the auth module (`PublicUser`).
class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    required this.isEmailVerified,
    required this.createdAt,
    this.authProvider = 'password',
  });

  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String role;
  final bool isEmailVerified;
  final DateTime createdAt;

  /// Original sign-up method: `password`, `google`, `apple` or `facebook`.
  final String authProvider;

  String get displayName => '$firstName $lastName'.trim();

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        id: json['id'] as String,
        email: json['email'] as String,
        firstName: json['firstName'] as String,
        lastName: json['lastName'] as String,
        role: json['role'] as String? ?? 'USER',
        isEmailVerified: json['isEmailVerified'] as bool? ?? false,
        createdAt: DateTime.tryParse(json['createdAt'] as String) ??
            DateTime.now(),
        authProvider: json['authProvider'] as String? ?? 'password',
      );
}

/// The account owning the verified email already exists but was created by a
/// different method. Decision 4 forbids auto-linking: the user must confirm
/// ownership (password or emailed link) before the Facebook identity is linked.
class SocialLinkConfirmation {
  const SocialLinkConfirmation({
    required this.email,
    required this.hasPassword,
    required this.idToken,
  });

  final String email;
  final bool hasPassword;

  /// Firebase ID token from the attempted Facebook sign-in; reused when
  /// completing the password confirmation so ownership is re-verified.
  final String idToken;
}

/// Payload of `POST /auth/signup` and `POST /auth/login`.
class AuthResult {
  const AuthResult({required this.user, required this.tokens});

  final AuthUser user;
  final AuthTokens tokens;

  factory AuthResult.fromJson(Map<String, dynamic> json) => AuthResult(
        user: AuthUser.fromJson(json['user'] as Map<String, dynamic>),
        tokens: AuthTokens.fromJson(json['tokens'] as Map<String, dynamic>),
      );
}

/// Payload of `POST /auth/refresh`.
class TokenPair {
  const TokenPair({required this.accessToken, required this.refreshToken});

  final String accessToken;
  final String refreshToken;

  factory TokenPair.fromJson(Map<String, dynamic> json) => TokenPair(
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
      );
}
