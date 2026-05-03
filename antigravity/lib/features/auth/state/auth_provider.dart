import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuthProvider extends ChangeNotifier {
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

  /// Load user from SharedPreferences
  Future<void> loadUser() async {
    final prefs = await SharedPreferences.getInstance();
    _isLoggedIn = prefs.getBool(_kIsLoggedIn) ?? false;
    _name = prefs.getString(_kName) ?? '';
    _email = prefs.getString(_kEmail) ?? '';
    _password = prefs.getString(_kPassword) ?? '';
    _phone = prefs.getString(_kPhone) ?? '';
    _country = prefs.getString(_kCountry) ?? '';
    _bio = prefs.getString(_kBio) ?? '';
    _profileImagePath = prefs.getString(_kProfileImagePath) ?? '';
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
    _isLoggedIn = false;

    await _save();
    notifyListeners();
    return true;
  }

  /// Login existing user
  Future<bool> login({
    required String email,
    required String password,
  }) async {
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
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kIsLoggedIn, false);
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

  /// Change email (requires current password verification)
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
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kIsLoggedIn, _isLoggedIn);
    await prefs.setString(_kName, _name);
    await prefs.setString(_kEmail, _email);
    await prefs.setString(_kPassword, _password);
    await prefs.setString(_kPhone, _phone);
    await prefs.setString(_kCountry, _country);
    await prefs.setString(_kBio, _bio);
    await prefs.setString(_kProfileImagePath, _profileImagePath);
  }
}
