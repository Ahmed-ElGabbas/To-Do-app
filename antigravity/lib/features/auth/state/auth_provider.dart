import 'dart:io';
import 'package:flutter/material.dart';
import 'package:tasko/core/network/api_error.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/core/network/models/auth.dart';
import 'package:tasko/core/network/models/user.dart';
import 'package:tasko/shared/services/push_service.dart';

/// Authenticates against the Tasko backend with JWT access/refresh tokens.
///
/// The access token is attached to every request by the [ApiClient] interceptor
/// and silently refreshed when it expires. [isLoggedIn] reflects a session that
/// either still has a valid refresh token or a freshly restored profile.
class AuthProvider extends ChangeNotifier {
  AuthProvider({AppServices? services})
      : _services = services ?? AppServices.instance;

  final AppServices _services;

  AuthUser? _user;
  UserProfile? _profile;
  bool _isLoggedIn = false;
  bool _isRestoring = false;
  String? _errorMessage;
  Future<void>? _restorationFuture;

  // Local-only profile extras retained for display (the backend does not
  // persist phone/country/bio or local avatar paths).
  String _phone = '';
  String _country = '';
  String _bio = '';
  String _profileImagePath = '';

  // ── Getters ───────────────────────────────────────────────────────────────

  bool get isLoggedIn => _isLoggedIn;
  bool get isRestoring => _isRestoring;
  String? get errorMessage => _errorMessage;
  AuthUser? get user => _user;
  UserProfile? get profile => _profile;

  String get userId => _user?.id ?? _profile?.id ?? '';
  String get email => _user?.email ?? _profile?.email ?? '';
  String get name {
    final firstName = _user?.firstName ?? _profile?.firstName ?? '';
    final lastName = _user?.lastName ?? _profile?.lastName ?? '';
    return '$firstName $lastName'.trim();
  }

  String get role => _user?.role ?? _profile?.role ?? 'USER';
  bool get isAdmin => role == 'ADMIN';
  bool get isEmailVerified => _user?.isEmailVerified ?? _profile?.isEmailVerified ?? false;
  String? get avatarFileId => _profile?.avatarFileId;
  String get phone => _phone;
  String get country => _country;
  String get bio => _bio;
  String get profileImagePath => _profileImagePath;

  // ── Session restore ───────────────────────────────────────────────────────

  /// Completes when the session restore started by [loadUser] finishes. The
  /// splash screen awaits it so navigation is never based on a half-restored
  /// session.
  Future<void> get restorationDone =>
      _restorationFuture ?? Future<void>.value();

  /// Restores the session from the persisted refresh token. No-op when there
  /// is no stored session; signs the user out if the profile cannot be loaded.
  Future<void> loadUser() {
    final future = _restore();
    _restorationFuture = future;
    return future;
  }

  Future<void> _restore() async {
    final refreshToken = await _services.tokenStore.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      _isLoggedIn = false;
      notifyListeners();
      return;
    }

    _isRestoring = true;
    notifyListeners();
    try {
      final user = await _services.authApi.me();
      _user = user;
      _profile = await _services.userApi.me();
      _isLoggedIn = true;
      _errorMessage = null;
      await _syncPushToken();
    } on ApiException {
      _isLoggedIn = false;
      _user = null;
      _profile = null;
    } finally {
      _isRestoring = false;
      notifyListeners();
    }
  }

  // ── Auth actions ──────────────────────────────────────────────────────────

  Future<bool> signUp({
    required String name,
    required String email,
    required String password,
    String phone = '',
    String country = '',
    String bio = '',
    String profileImagePath = '',
  }) async {
    _errorMessage = null;
    final (firstName, lastName) = _splitName(name);
    try {
      final result = await _services.authApi.signup(
        email: email,
        password: password,
        firstName: firstName ?? '',
        lastName: lastName ?? '',
      );
      await _applyAuthResult(result);
      _phone = phone;
      _country = country;
      _bio = bio;
      _profileImagePath = profileImagePath;
      _isLoggedIn = true;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    }
  }

  Future<bool> login({
    required String email,
    required String password,
  }) async {
    _errorMessage = null;
    try {
      final result = await _services.authApi.login(email: email, password: password);
      await _applyAuthResult(result);
      _isLoggedIn = true;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    }
  }

  /// Signs in with a Firebase ID token from a social provider (`google`,
  /// `apple`, `facebook`). The backend verifies the token and links/creates the
  /// account by verified email.
  Future<bool> socialLogin({
    required String idToken,
    required String provider,
  }) async {
    _errorMessage = null;
    try {
      final result = await _services.authApi.socialLogin(
        idToken: idToken,
        provider: provider,
      );
      await _applyAuthResult(result);
      _isLoggedIn = true;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    }
  }

  /// Signs out locally and best-effort revokes the refresh session on the
  /// backend so the token family cannot be replayed.
  Future<void> logout() async {
    final refreshToken = await _services.tokenStore.readRefreshToken();
    _isLoggedIn = false;
    _user = null;
    _profile = null;
    await _revokePushToken();
    await _services.tokenStore.clear();
    notifyListeners();
    if (refreshToken != null && refreshToken.isNotEmpty) {
      try {
        await _services.authApi.logout(refreshToken);
      } on ApiException {
        // Session was already cleared locally; backend revocation is best-effort.
      }
    }
  }

  Future<bool> updateProfile({
    String? name,
    String? phone,
    String? country,
    String? bio,
    String? profileImagePath,
  }) async {
    _errorMessage = null;
    try {
      final (firstName, lastName) =
          name != null ? _splitName(name) : (null, null);
      final updated = await _services.userApi.updateProfile(
        firstName: firstName,
        lastName: lastName,
      );
      _profile = updated;
      if (updated.firstName.isNotEmpty) {
        _user = _user != null
            ? _syncUserNames(_user!, updated)
            : _user;
      }
      if (phone != null) _phone = phone;
      if (country != null) _country = country;
      if (bio != null) _bio = bio;
      if (profileImagePath != null) _profileImagePath = profileImagePath;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    }
  }

  Future<bool> uploadAvatar(File file) async {
    _errorMessage = null;
    try {
      await _services.fileApi.uploadAvatar(file);
      _profileImagePath = file.path;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    }
  }

  Future<bool> changePassword({
    required String oldPassword,
    required String newPassword,
  }) async {
    _errorMessage = null;
    try {
      await _services.authApi.changePassword(
        currentPassword: oldPassword,
        newPassword: newPassword,
      );
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    }
  }

  Future<bool> changeEmail({
    required String currentPassword,
    required String newEmail,
  }) async {
    _errorMessage = null;
    try {
      await _services.authApi.changeEmail(
        email: newEmail,
        currentPassword: currentPassword,
      );
      if (_user != null) {
        _user = AuthUser(
          id: _user!.id,
          email: newEmail,
          firstName: _user!.firstName,
          lastName: _user!.lastName,
          role: _user!.role,
          isEmailVerified: false,
          createdAt: _user!.createdAt,
        );
      }
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    }
  }

  /// Requests a password reset email for [email].
  Future<bool> forgotPassword(String email) async {
    _errorMessage = null;
    try {
      await _services.authApi.forgotPassword(email);
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    }
  }

  /// Completes the password reset with the token emailed to the user.
  Future<bool> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    _errorMessage = null;
    try {
      await _services.authApi.resetPassword(token: token, newPassword: newPassword);
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  Future<void> _applyAuthResult(AuthResult result) async {
    _user = result.user;
    _isLoggedIn = true;
    _errorMessage = null;
    await _services.tokenStore.write(
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    );
    await _syncPushToken();
  }

  /// Registers the FCM device token with the backend once a session exists.
  /// No-op when push is not initialized (widget tests); never fails the login.
  Future<void> _syncPushToken() async {
    final push = PushService.instance;
    if (push == null) return;
    await push.syncCurrentToken();
  }

  /// Best-effort revokes the FCM device token so a logged-out app no longer
  /// receives pushes. Runs before the local session is cleared.
  Future<void> _revokePushToken() async {
    final push = PushService.instance;
    if (push == null) return;
    await push.revokeCurrentToken();
  }

  AuthUser _syncUserNames(AuthUser user, UserProfile profile) => AuthUser(
        id: user.id,
        email: user.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
      );

  /// Splits a display name into `(firstName, lastName)` using the last space
  /// as the boundary; a single-word name becomes `(name, '')`.
  (String?, String?) _splitName(String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return (null, null);
    final lastSpace = trimmed.lastIndexOf(' ');
    if (lastSpace == -1) return (trimmed, '');
    return (trimmed.substring(0, lastSpace), trimmed.substring(lastSpace + 1));
  }
}
