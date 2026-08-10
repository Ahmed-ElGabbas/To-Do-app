import 'package:dio/dio.dart';

import '../api_client.dart';
import '../models/auth.dart';

class AuthApi {
  AuthApi(this._client);

  final ApiClient _client;

  Future<AuthResult> signup({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
  }) async {
    final response = await _client.post('/auth/signup', data: {
      'email': email,
      'password': password,
      'firstName': firstName,
      'lastName': lastName,
    });
    return AuthResult.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<AuthResult> login({
    required String email,
    required String password,
  }) async {
    final response = await _client.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    return AuthResult.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<AuthResult> socialLogin({
    required String idToken,
    required String provider,
  }) async {
    final response = await _client.post('/auth/social-login', data: {
      'idToken': idToken,
      'provider': provider,
    });
    return AuthResult.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<AuthTokens> refresh(String refreshToken) async {
    final response = await _client.post('/auth/refresh', data: {
      'refreshToken': refreshToken,
    });
    return AuthTokens.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  Future<void> verifyEmail(String token) async {
    await _client.post('/auth/verify-email', data: {'token': token});
  }

  Future<void> forgotPassword(String email) async {
    await _client.post('/auth/forgot-password', data: {'email': email});
  }

  Future<void> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    await _client.post('/auth/reset-password', data: {
      'token': token,
      'newPassword': newPassword,
    });
  }

  Future<void> logout(String refreshToken) async {
    await _client.post('/auth/logout', data: {'refreshToken': refreshToken});
  }

  Future<void> logoutAll() async {
    await _client.post('/auth/logout-all');
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _client.patch('/auth/change-password', data: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }

  Future<void> changeEmail({
    required String email,
    required String currentPassword,
  }) async {
    await _client.patch('/auth/change-email', data: {
      'email': email,
      'currentPassword': currentPassword,
    });
  }

  Future<AuthUser> me() async {
    final response = await _client.get('/auth/me');
    return AuthUser.fromJson(
      _client.unwrap(response) as Map<String, dynamic>,
    );
  }

  /// Performs a raw refresh call bypassing the auth interceptor (the client is
  /// constructed with an interceptor that must not recurse on 401).
  static Future<AuthTokens> rawRefresh(
    Dio dio,
    String refreshToken,
  ) async {
    final response = await dio.post(
      '/auth/refresh',
      data: {'refreshToken': refreshToken},
      options: Options(extra: {'skipRefresh': true}),
    );
    final body = response.data as Map<String, dynamic>;
    if (body['success'] != true) {
      throw DioException.badResponse(
        statusCode: response.statusCode ?? 401,
        requestOptions: response.requestOptions,
        response: response,
      );
    }
    return AuthTokens.fromJson(body['data'] as Map<String, dynamic>);
  }
}
