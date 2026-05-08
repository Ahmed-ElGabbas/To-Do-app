import 'package:flutter/material.dart';
import 'package:tasko/shared/services/local_storage_service.dart';

class AuthProvider extends ChangeNotifier {
  final _storage = LocalStorageService();

  // Keys
  static const _kIsLoggedIn = 'auth_is_logged_in';
  static const _kName = 'auth_name';
  static const _kEmail = 'auth_email';
  static const _kPassword = 'auth_password';
  static const _kPhone = 'auth_phone';
  static const _kCountry = 'auth_country';
  static const _kBio = 'auth_bio';
  static const _kProfileImagePath = 'auth_profile_image_path';

  // State
  bool _isLoggedIn = false;
  String _name = '';
  String _email = '';
  String _password = '';
  String _phone = '';
  String _country = '';
  String _bio = '';
  String _profileImagePath = '';

  // Getters
  bool get isLoggedIn => _isLoggedIn;
  String get name => _name;
  String get email => _email;
  String get password => _password;
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
    _password = _storage.read(_kPassword) ?? '';
    _phone = _storage.read(_kPhone) ?? '';
    _country = _storage.read(_kCountry) ?? '';
    _bio = _storage.read(_kBio) ?? '';
    _profileImagePath = _storage.read(_kProfileImagePath) ?? '';
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
    _password = password;
    _phone = phone;
    _country = country;
    _bio = bio;
    _profileImagePath = profileImagePath;
    _isLoggedIn = true;

    await _save();
    notifyListeners();
    return true;
  }

  /// Login existing user
  Future<bool> login({
    required String email,
    required String password,
  }) async {
    // Basic verification against stored credentials
    if (_email == email && _password == password) {
      _isLoggedIn = true;
      await _save();
      notifyListeners();
      return true;
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
    if (_password != currentPassword) return false;
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
    if (_password != oldPassword) return false;
    _password = newPassword;
    await _save();
    notifyListeners();
    return true;
  }

  Future<void> _save() async {
    await _storage.writeBool(_kIsLoggedIn, _isLoggedIn);
    await _storage.write(_kName, _name);
    await _storage.write(_kEmail, _email);
    await _storage.write(_kPassword, _password);
    await _storage.write(_kPhone, _phone);
    await _storage.write(_kCountry, _country);
    await _storage.write(_kBio, _bio);
    await _storage.write(_kProfileImagePath, _profileImagePath);
  }
}
