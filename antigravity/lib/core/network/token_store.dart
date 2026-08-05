import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the session tokens.
abstract interface class TokenStorage {
  Future<String?> readAccessToken();
  Future<String?> readRefreshToken();
  Future<void> write({
    required String accessToken,
    required String refreshToken,
  });
  Future<void> updateAccessToken(String accessToken);
  Future<void> clear();
}

/// Secure [TokenStorage] backed by the platform keychain/keystore.
///
/// The access token is short lived (default 15 minutes on the backend) while
/// the refresh token is long lived (30 days) and rotated on every refresh.
class SecureTokenStorage implements TokenStorage {
  SecureTokenStorage({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const _accessKey = 'tasko.access_token';
  static const _refreshKey = 'tasko.refresh_token';

  final FlutterSecureStorage _storage;

  @override
  Future<String?> readAccessToken() => _storage.read(key: _accessKey);

  @override
  Future<String?> readRefreshToken() => _storage.read(key: _refreshKey);

  @override
  Future<void> write({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _accessKey, value: accessToken);
    await _storage.write(key: _refreshKey, value: refreshToken);
  }

  @override
  Future<void> updateAccessToken(String accessToken) =>
      _storage.write(key: _accessKey, value: accessToken);

  @override
  Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }
}
