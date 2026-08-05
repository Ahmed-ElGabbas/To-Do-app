import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/features/auth/state/auth_provider.dart';

import 'core/network/test_services.dart';

Map<String, dynamic> userJson({
  String id = 'user-1',
  String email = 'test@test.com',
  String firstName = 'Test',
  String lastName = 'User',
  String role = 'USER',
  bool isEmailVerified = false,
}) =>
    {
      'id': id,
      'email': email,
      'firstName': firstName,
      'lastName': lastName,
      'role': role,
      'isEmailVerified': isEmailVerified,
      'createdAt': '2025-01-01T00:00:00.000Z',
    };

Map<String, dynamic> profileJson({
  String id = 'user-1',
  String email = 'test@test.com',
  String firstName = 'Test',
  String lastName = 'User',
  String role = 'USER',
  bool isEmailVerified = false,
}) =>
    {
      ...userJson(
        id: id,
        email: email,
        firstName: firstName,
        lastName: lastName,
        role: role,
        isEmailVerified: isEmailVerified,
      ),
      'updatedAt': '2025-01-01T00:00:00.000Z',
    };

Map<String, dynamic> authResultJson({
  String id = 'user-1',
  String email = 'test@test.com',
  String firstName = 'Test',
  String lastName = 'User',
  String role = 'USER',
  bool isEmailVerified = false,
}) =>
    {
      'user': userJson(
        id: id,
        email: email,
        firstName: firstName,
        lastName: lastName,
        role: role,
        isEmailVerified: isEmailVerified,
      ),
      'tokens': {'accessToken': 'access-1', 'refreshToken': 'refresh-1'},
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('loadUser', () {
    test('signs the user out when no refresh token is stored', () async {
      final backend = TestBackend(
          (options, attempt) => throw StateError('no request expected'));
      final auth = AuthProvider(services: backend.services);

      await auth.loadUser();

      expect(auth.isLoggedIn, isFalse);
      expect(auth.isRestoring, isFalse);
    });

    test('restores a valid session from the stored refresh token', () async {
      final backend = TestBackend((options, attempt) {
        switch ('${options.method} ${options.path}') {
          case 'GET /auth/me':
            return ok(userJson());
          case 'GET /users/me':
            return ok(profileJson());
          default:
            throw StateError('unexpected ${options.method} ${options.path}');
        }
      });
      backend.storage.accessToken = 'access-1';
      backend.storage.refreshToken = 'refresh-1';
      final auth = AuthProvider(services: backend.services);

      await auth.loadUser();

      expect(auth.isLoggedIn, isTrue);
      expect(auth.isRestoring, isFalse);
      expect(auth.email, 'test@test.com');
      expect(auth.name, 'Test User');
      expect(auth.profile, isNotNull);
    });

    test('signs out when the backend rejects the session', () async {
      final backend = TestBackend(
          (options, attempt) => failResponse('UNAUTHORIZED', 'Token expired',
              status: 401));
      backend.storage.refreshToken = 'refresh-1';
      final auth = AuthProvider(services: backend.services);

      await auth.loadUser();

      expect(auth.isLoggedIn, isFalse);
      expect(auth.isRestoring, isFalse);
    });
  });

  group('login', () {
    test('succeeds, persists tokens and populates the user', () async {
      final backend = TestBackend((options, attempt) {
        expect(options.method, 'POST');
        expect(options.path, '/auth/login');
        return ok(authResultJson());
      });
      final auth = AuthProvider(services: backend.services);

      final result =
          await auth.login(email: 'test@test.com', password: 'secret');

      expect(result, isTrue);
      expect(auth.isLoggedIn, isTrue);
      expect(auth.user?.email, 'test@test.com');
      expect(auth.name, 'Test User');
      expect(backend.storage.accessToken, 'access-1');
      expect(backend.storage.refreshToken, 'refresh-1');
    });

    test('fails on invalid credentials', () async {
      final backend = TestBackend((options, attempt) =>
          failResponse('INVALID_CREDENTIALS', 'Invalid credentials', status: 401));
      final auth = AuthProvider(services: backend.services);

      final result =
          await auth.login(email: 'test@test.com', password: 'wrong');

      expect(result, isFalse);
      expect(auth.isLoggedIn, isFalse);
      expect(auth.errorMessage, isNotNull);
    });
  });

  group('signUp', () {
    test('splits the display name and stores local extras', () async {
      RequestOptions? captured;
      final backend = TestBackend((options, attempt) {
        captured = options;
        return ok(authResultJson(
          email: 'jane@test.com',
          firstName: 'Jane',
          lastName: 'Doe',
        ));
      });
      final auth = AuthProvider(services: backend.services);

      final result = await auth.signUp(
        name: 'Jane Doe',
        email: 'jane@test.com',
        password: 'secret',
        phone: '123',
        country: 'US',
        bio: 'hello',
      );

      expect(result, isTrue);
      expect(captured!.data, {
        'email': 'jane@test.com',
        'password': 'secret',
        'firstName': 'Jane',
        'lastName': 'Doe',
      });
      expect(auth.isLoggedIn, isTrue);
      expect(auth.phone, '123');
      expect(auth.country, 'US');
      expect(auth.bio, 'hello');
    });

    test('a single-word name becomes the first name', () async {
      RequestOptions? captured;
      final backend = TestBackend((options, attempt) {
        captured = options;
        return ok(authResultJson(firstName: 'Jane', lastName: ''));
      });
      final auth = AuthProvider(services: backend.services);

      final result = await auth.signUp(
        name: 'Jane',
        email: 'jane@test.com',
        password: 'secret',
      );

      expect(result, isTrue);
      expect(captured!.data['firstName'], 'Jane');
      expect(captured!.data['lastName'], '');
    });

    test('fails and surfaces the server message', () async {
      final backend = TestBackend((options, attempt) =>
          failResponse('VALIDATION_ERROR', 'Email already registered', status: 409));
      final auth = AuthProvider(services: backend.services);

      final result = await auth.signUp(
        name: 'Jane Doe',
        email: 'jane@test.com',
        password: 'secret',
      );

      expect(result, isFalse);
      expect(auth.isLoggedIn, isFalse);
      expect(auth.errorMessage, isNotNull);
    });
  });

  group('logout', () {
    test('clears the session and revokes the refresh token', () async {
      final requests = <String>[];
      final backend = TestBackend((options, attempt) {
        requests.add('${options.method} ${options.path}');
        return ok(null);
      });
      backend.storage.accessToken = 'access-1';
      backend.storage.refreshToken = 'refresh-1';
      final auth = AuthProvider(services: backend.services);

      await auth.logout();

      expect(requests, ['POST /auth/logout']);
      expect(backend.storage.accessToken, isNull);
      expect(backend.storage.refreshToken, isNull);
      expect(auth.isLoggedIn, isFalse);
    });

    test('a failed backend revocation is ignored', () async {
      final backend = TestBackend((options, attempt) =>
          failResponse('UNAUTHORIZED', 'Token expired', status: 401));
      backend.storage.refreshToken = 'refresh-1';
      final auth = AuthProvider(services: backend.services);

      await auth.logout();

      expect(auth.isLoggedIn, isFalse);
      expect(backend.storage.refreshToken, isNull);
    });
  });

  group('changePassword', () {
    test('succeeds when the current password matches', () async {
      RequestOptions? captured;
      final backend = TestBackend((options, attempt) {
        captured = options;
        return ok(null);
      });
      final auth = AuthProvider(services: backend.services);

      final result = await auth.changePassword(
        oldPassword: 'old',
        newPassword: 'new',
      );

      expect(result, isTrue);
      expect(captured!.method, 'PATCH');
      expect(captured!.path, '/auth/change-password');
      expect(captured!.data,
          {'currentPassword': 'old', 'newPassword': 'new'});    });

    test('fails with an incorrect current password', () async {
      final backend = TestBackend((options, attempt) =>
          failResponse('UNAUTHORIZED', 'Invalid password', status: 401));
      final auth = AuthProvider(services: backend.services);

      final result = await auth.changePassword(
        oldPassword: 'wrong',
        newPassword: 'new',
      );

      expect(result, isFalse);
      expect(auth.errorMessage, isNotNull);
    });
  });

  group('changeEmail', () {
    test('updates the email and clears the verified flag', () async {
      final backend = TestBackend((options, attempt) {
        switch ('${options.method} ${options.path}') {
          case 'POST /auth/login':
            return ok(authResultJson(isEmailVerified: true));
          case 'PATCH /auth/change-email':
            return ok(null);
          default:
            throw StateError('unexpected ${options.method} ${options.path}');
        }
      });
      final auth = AuthProvider(services: backend.services);
      await auth.login(email: 'test@test.com', password: 'secret');

      final result = await auth.changeEmail(
        currentPassword: 'secret',
        newEmail: 'new@test.com',
      );

      expect(result, isTrue);
      expect(auth.email, 'new@test.com');
      expect(auth.isEmailVerified, isFalse);
    });

    test('fails and keeps the current email', () async {
      final backend = TestBackend((options, attempt) {
        switch ('${options.method} ${options.path}') {
          case 'POST /auth/login':
            return ok(authResultJson());
          case 'PATCH /auth/change-email':
            return failResponse('UNAUTHORIZED', 'Invalid password', status: 401);
          default:
            throw StateError('unexpected ${options.method} ${options.path}');
        }
      });
      final auth = AuthProvider(services: backend.services);
      await auth.login(email: 'test@test.com', password: 'secret');

      final result = await auth.changeEmail(
        currentPassword: 'wrong',
        newEmail: 'new@test.com',
      );

      expect(result, isFalse);
      expect(auth.email, 'test@test.com');
    });
  });

  group('forgotPassword / resetPassword', () {
    test('forgotPassword succeeds and sends the email', () async {
      RequestOptions? captured;
      final backend = TestBackend((options, attempt) {
        captured = options;
        return ok(null);
      });
      final auth = AuthProvider(services: backend.services);

      final result = await auth.forgotPassword('test@test.com');

      expect(result, isTrue);
      expect(captured!.path, '/auth/forgot-password');
      expect(captured!.data, {'email': 'test@test.com'});
    });

    test('forgotPassword fails for an unknown email', () async {
      final backend = TestBackend((options, attempt) =>
          failResponse('RESOURCE_NOT_FOUND', 'Account not found', status: 404));
      final auth = AuthProvider(services: backend.services);

      final result = await auth.forgotPassword('nobody@test.com');

      expect(result, isFalse);
      expect(auth.errorMessage, isNotNull);
    });

    test('resetPassword succeeds with the emailed token', () async {
      RequestOptions? captured;
      final backend = TestBackend((options, attempt) {
        captured = options;
        return ok(null);
      });
      final auth = AuthProvider(services: backend.services);

      final result = await auth.resetPassword(
        token: 'token-1',
        newPassword: 'newpass',
      );

      expect(result, isTrue);
      expect(captured!.path, '/auth/reset-password');
      expect(captured!.data, {'token': 'token-1', 'newPassword': 'newpass'});
    });

    test('resetPassword fails with an invalid token', () async {
      final backend = TestBackend(
          (options, attempt) => failResponse('VALIDATION_ERROR', 'Bad token',
              status: 400));
      final auth = AuthProvider(services: backend.services);

      final result = await auth.resetPassword(
        token: 'bad-token',
        newPassword: 'newpass',
      );

      expect(result, isFalse);
    });
  });

  group('updateProfile', () {
    test('updates names and local extras', () async {
      final backend = TestBackend((options, attempt) {
        switch ('${options.method} ${options.path}') {
          case 'POST /auth/login':
            return ok(authResultJson());
          case 'PATCH /users/me':
            return ok(profileJson(firstName: 'New', lastName: 'Name'));
          default:
            throw StateError('unexpected ${options.method} ${options.path}');
        }
      });
      final auth = AuthProvider(services: backend.services);
      await auth.login(email: 'test@test.com', password: 'secret');

      final result = await auth.updateProfile(name: 'New Name', bio: 'Hi');

      expect(result, isTrue);
      expect(auth.name, 'New Name');
      expect(auth.bio, 'Hi');
    });

    test('fails when the backend rejects the update', () async {
      final backend = TestBackend((options, attempt) => failResponse(
          'VALIDATION_ERROR', 'Invalid profile', status: 422));
      final auth = AuthProvider(services: backend.services);

      final result = await auth.updateProfile(name: 'New Name');

      expect(result, isFalse);
      expect(auth.errorMessage, isNotNull);
    });
  });

  group('role', () {
    test('exposes admin status from the role field', () async {
      final backend = TestBackend((options, attempt) =>
          ok(authResultJson(role: 'ADMIN')));
      final auth = AuthProvider(services: backend.services);

      await auth.login(email: 'admin@test.com', password: 'secret');

      expect(auth.isAdmin, isTrue);
      expect(auth.role, 'ADMIN');
    });
  });

  group('uploadAvatar', () {
    test('uploads the file and caches the local path', () async {
      final file = File('${Directory.systemTemp.path}/tasko_avatar_test.png');
      await file.writeAsBytes([1, 2, 3]);
      final backend = TestBackend((options, attempt) {
        expect(options.method, 'POST');
        expect(options.path, '/files/avatar');
        return ok({
          'id': 'file-1',
          'kind': 'avatar',
          'mimeType': 'image/png',
          'size': 3,
          'originalName': 'avatar.png',
          'url': 'https://cdn.test/avatar.png',
          'createdAt': '2025-01-01T00:00:00.000Z',
        });
      });
      final auth = AuthProvider(services: backend.services);

      final result = await auth.uploadAvatar(file);

      expect(result, isTrue);
      expect(auth.profileImagePath, file.path);
      try {
        await file.delete();
      } on FileSystemException {
        // The upload keeps the handle open; the temp file is harmless.
      }
    });

    test('fails when the backend rejects the upload', () async {
      final file = File('${Directory.systemTemp.path}/tasko_avatar_bad.png');
      await file.writeAsBytes([1, 2, 3]);
      final backend = TestBackend((options, attempt) =>
          failResponse('FILE_TOO_LARGE', 'Too big', status: 413));
      final auth = AuthProvider(services: backend.services);

      final result = await auth.uploadAvatar(file);

      expect(result, isFalse);
      expect(auth.profileImagePath, isEmpty);
      try {
        await file.delete();
      } on FileSystemException {
        // The upload keeps the handle open; the temp file is harmless.
      }
    });
  });
}
