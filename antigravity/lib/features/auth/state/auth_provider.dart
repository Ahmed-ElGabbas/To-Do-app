import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:tasko/core/utils/password_hasher.dart';
import 'package:tasko/shared/services/local_storage_service.dart';

class AuthProvider extends ChangeNotifier {
  final _storage = LocalStorageService();
  final _secureStorage = const FlutterSecureStorage();

  // Keys
  static const _kIsLoggedIn = 'auth_is_logged_in';
  static const _kName = 'auth_name';
  static const _kEmail = 'auth_email';
  static const _kPassword = 'auth_password';
  static const _kPasswordHash = 'auth_password_hash';
  static const _kPasswordSalt = 'auth_password_salt';
  static const _kPhone = 'auth_phone';
  static const _kCountry = 'auth_country';
  static const _kBio = 'auth_bio';
  static const _kProfileImagePath = 'auth_profile_image_path';

  // State
  bool _isLoggedIn = false;
  String _name = '';
  String _email = '';
  String _passwordHash = '';
  String _passwordSalt = '';
  String _phone = '';
  String _country = '';
  String _bio = '';
  String _profileImagePath = '';

  // Getters
  bool get isLoggedIn => _isLoggedIn;
  String get name => _name;
  String get email => _email;
  String get phone => _phone;
  String get country => _country;
  String get bio => _bio;
  String get profileImagePath => _profileImagePath;

  /// Load user from LocalStorageService (SharedPreferences)
  /// This must be called and awaited if you want immediate values,
  /// but usually called in MultiProvider create.
  Future<void> loadUser() async {
    _isLoggedIn = _storage.readBool(_kIsLoggedIn) ?? false;
    _name = _storage.read(_kName) ?? '';
    _email = _storage.read(_kEmail) ?? '';
    _phone = _storage.read(_kPhone) ?? '';
    _country = _storage.read(_kCountry) ?? '';
    _bio = _storage.read(_kBio) ?? '';
    _profileImagePath = _storage.read(_kProfileImagePath) ?? '';

    // Step 1: Legacy migration — SharedPreferences plaintext → secure storage
    final legacyPassword = _storage.read(_kPassword);
    if (legacyPassword != null && legacyPassword.isNotEmpty) {
      await _secureStorage.write(key: _kPassword, value: legacyPassword);
      await _storage.delete(_kPassword);
    }

    // Step 2: Upgrade unsalted secure-storage password to hash+salt format
    final existingSalt = await _secureStorage.read(key: _kPasswordSalt);
    if (existingSalt == null || existingSalt.isEmpty) {
      final rawPassword = await _secureStorage.read(key: _kPassword);
      if (rawPassword != null && rawPassword.isNotEmpty) {
        final salt = generateSalt();
        final hash = hashPassword(rawPassword, salt);
        await _secureStorage.write(key: _kPasswordHash, value: hash);
        await _secureStorage.write(key: _kPasswordSalt, value: salt);
        await _secureStorage.delete(key: _kPassword);
        _passwordHash = hash;
        _passwordSalt = salt;
      } else {
        _passwordHash = '';
        _passwordSalt = '';
      }
    } else {
      _passwordHash = await _secureStorage.read(key: _kPasswordHash) ?? '';
      _passwordSalt = existingSalt;
    }

    notifyListeners();
  }

  /// Sign up new user
  Future<bool> signUp({
    required String name,
    required String email,
    required String password,
    String phone = '',
    String country = '',
    String bio = '',
    String profileImagePath = '',
  }) async {
    _name = name;
    _email = email;
    _phone = phone;
    _country = country;
    _bio = bio;
    _profileImagePath = profileImagePath;
    _isLoggedIn = true;

    final salt = generateSalt();
    _passwordHash = hashPassword(password, salt);
    _passwordSalt = salt;

    await _save();
    notifyListeners();
    return true;
  }

  /// Login existing user
  Future<bool> login({
    required String email,
    required String password,
  }) async {
    if (_email == email && _passwordHash.isNotEmpty) {
      final inputHash = hashPassword(password, _passwordSalt);
      if (_passwordHash == inputHash) {
        _isLoggedIn = true;
        await _save();
        notifyListeners();
        return true;
      }
    }
    return false;
  }

  /// Logout current user
  Future<void> logout() async {
    _isLoggedIn = false;
    await _storage.writeBool(_kIsLoggedIn, false);
    notifyListeners();
  }

  /// Update profile fields
  Future<void> updateProfile({
    String? name,
    String? phone,
    String? country,
    String? bio,
    String? profileImagePath,
  }) async {
    if (name != null) _name = name;
    if (phone != null) _phone = phone;
    if (country != null) _country = country;
    if (bio != null) _bio = bio;
    if (profileImagePath != null) _profileImagePath = profileImagePath;
    await _save();
    notifyListeners();
  }

  /// Change email
  Future<bool> changeEmail({
    required String currentPassword,
    required String newEmail,
  }) async {
    final inputHash = hashPassword(currentPassword, _passwordSalt);
    if (_passwordHash != inputHash) return false;
    await _storage.renameUserTasks(_email, newEmail);
    _email = newEmail;
    await _save();
    notifyListeners();
    return true;
  }

  /// Change password
  Future<bool> changePassword({
    required String oldPassword,
    required String newPassword,
  }) async {
    final inputHash = hashPassword(oldPassword, _passwordSalt);
    if (_passwordHash != inputHash) return false;
    final salt = generateSalt();
    _passwordHash = hashPassword(newPassword, salt);
    _passwordSalt = salt;
    await _save();
    notifyListeners();
    return true;
  }

  /// Reset password after verifying the registered email.
  /// Local-only recovery: the email is the only identity check available
  /// without a backend, so this must be surfaced honestly in the UI.
  Future<bool> resetPassword({
    required String email,
    required String newPassword,
  }) async {
    if (_email != email || _passwordHash.isEmpty) return false;
    final salt = generateSalt();
    _passwordHash = hashPassword(newPassword, salt);
    _passwordSalt = salt;
    await _save();
    notifyListeners();
    return true;
  }

  Future<void> _save() async {
    await _storage.writeBool(_kIsLoggedIn, _isLoggedIn);
    await _storage.write(_kName, _name);
    await _storage.write(_kEmail, _email);
    await _secureStorage.write(key: _kPasswordHash, value: _passwordHash);
    await _secureStorage.write(key: _kPasswordSalt, value: _passwordSalt);
    await _storage.write(_kPhone, _phone);
    await _storage.write(_kCountry, _country);
    await _storage.write(_kBio, _bio);
    await _storage.write(_kProfileImagePath, _profileImagePath);
  }
}
