import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tasko/core/utils/password_hasher.dart';
import 'package:tasko/features/auth/state/auth_provider.dart';
import 'package:tasko/features/todo/data/models/task_model.dart';
import 'package:tasko/shared/services/local_storage_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late AuthProvider auth;
  final secureStorage = <String, String>{};

  Future<void> setupAuth({
    Map<String, Object> sharedPrefs = const {},
    Map<String, String> securePrefs = const {},
  }) async {
    secureStorage.clear();
    secureStorage.addAll(securePrefs);

    SharedPreferences.setMockInitialValues(sharedPrefs.cast<String, Object>());
    await LocalStorageService().init();

    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    for (final entry in sharedPrefs.entries) {
      final v = entry.value;
      if (v is String) {
        await prefs.setString(entry.key, v);
      } else if (v is bool) {
        await prefs.setBool(entry.key, v);
      } else if (v is int) {
        await prefs.setInt(entry.key, v);
      } else if (v is double) {
        await prefs.setDouble(entry.key, v);
      }
    }

    auth = AuthProvider();
    await auth.loadUser();
  }

  setUpAll(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (MethodCall methodCall) async {
        switch (methodCall.method) {
          case 'read':
            final key = methodCall.arguments['key'] as String;
            return secureStorage[key];
          case 'write':
            final key = methodCall.arguments['key'] as String;
            final value = methodCall.arguments['value'] as String;
            secureStorage[key] = value;
            return null;
          case 'delete':
            final key = methodCall.arguments['key'] as String;
            secureStorage.remove(key);
            return null;
          case 'readAll':
            return Map<String, String>.from(secureStorage);
          case 'deleteAll':
            secureStorage.clear();
            return null;
          case 'containsKey':
            final key = methodCall.arguments['key'] as String;
            return secureStorage.containsKey(key);
          default:
            return null;
        }
      },
    );
  });

  group('fresh install', () {
    setUp(() async {
      await setupAuth();
    });

    test('signUp stores hash + salt, never raw password', () async {
      final result = await auth.signUp(
        name: 'Test User',
        email: 'test@test.com',
        password: 'mypassword',
      );

      expect(result, isTrue);
      expect(secureStorage.containsKey('auth_password'), isFalse);
      expect(secureStorage.containsKey('auth_password_hash'), isTrue);
      expect(secureStorage.containsKey('auth_password_salt'), isTrue);
    });

    test('login with correct password succeeds', () async {
      await auth.signUp(
        name: 'Test User',
        email: 'test@test.com',
        password: 'mypassword',
      );

      final result = await auth.login(
        email: 'test@test.com',
        password: 'mypassword',
      );

      expect(result, isTrue);
      expect(auth.isLoggedIn, isTrue);
    });

    test('login with wrong password fails', () async {
      await auth.signUp(
        name: 'Test User',
        email: 'test@test.com',
        password: 'mypassword',
      );

      final result = await auth.login(
        email: 'test@test.com',
        password: 'wrongpassword',
      );

      expect(result, isFalse, reason: 'wrong password should not match');
    });

    test('login with wrong email fails', () async {
      await auth.signUp(
        name: 'Test User',
        email: 'test@test.com',
        password: 'mypassword',
      );

      final result = await auth.login(
        email: 'other@test.com',
        password: 'mypassword',
      );

      expect(result, isFalse);
    });
  });

  group('changePassword', () {
    setUp(() async {
      await setupAuth();
      await auth.signUp(
        name: 'Test User',
        email: 'test@test.com',
        password: 'oldpassword',
      );
    });

    test('succeeds with correct old password', () async {
      final result = await auth.changePassword(
        oldPassword: 'oldpassword',
        newPassword: 'newpassword',
      );

      expect(result, isTrue);

      final loginWithOld = await auth.login(
        email: 'test@test.com',
        password: 'oldpassword',
      );
      expect(loginWithOld, isFalse);

      final loginWithNew = await auth.login(
        email: 'test@test.com',
        password: 'newpassword',
      );
      expect(loginWithNew, isTrue);
    });

    test('fails with incorrect old password', () async {
      final result = await auth.changePassword(
        oldPassword: 'wrongpassword',
        newPassword: 'newpassword',
      );

      expect(result, isFalse);

      final loginWithOld = await auth.login(
        email: 'test@test.com',
        password: 'oldpassword',
      );
      expect(loginWithOld, isTrue);
    });
  });

  group('resetPassword', () {
    setUp(() async {
      await setupAuth();
      await auth.signUp(
        name: 'Test User',
        email: 'test@test.com',
        password: 'oldpassword',
      );
    });

    test('succeeds with the registered email and updates in-memory state', () async {
      final result = await auth.resetPassword(
        email: 'test@test.com',
        newPassword: 'newpassword',
      );

      expect(result, isTrue);

      final loginWithOld = await auth.login(
        email: 'test@test.com',
        password: 'oldpassword',
      );
      expect(loginWithOld, isFalse);

      final loginWithNew = await auth.login(
        email: 'test@test.com',
        password: 'newpassword',
      );
      expect(loginWithNew, isTrue);
    });

    test('persists the new password across a full reload', () async {
      await auth.resetPassword(
        email: 'test@test.com',
        newPassword: 'newpassword',
      );

      auth = AuthProvider();
      await auth.loadUser();

      final loginWithNew = await auth.login(
        email: 'test@test.com',
        password: 'newpassword',
      );
      expect(loginWithNew, isTrue);

      final loginWithOld = await auth.login(
        email: 'test@test.com',
        password: 'oldpassword',
      );
      expect(loginWithOld, isFalse);
    });

    test('fails with a non-matching email and leaves password unchanged', () async {
      final result = await auth.resetPassword(
        email: 'other@test.com',
        newPassword: 'newpassword',
      );

      expect(result, isFalse);

      final loginWithOld = await auth.login(
        email: 'test@test.com',
        password: 'oldpassword',
      );
      expect(loginWithOld, isTrue);
    });

    test('fails when no account exists on the device', () async {
      await setupAuth();

      final result = await auth.resetPassword(
        email: 'nobody@test.com',
        newPassword: 'newpassword',
      );

      expect(result, isFalse);
    });
  });

  group('changeEmail', () {
    setUp(() async {
      await setupAuth();
      await auth.signUp(
        name: 'Test User',
        email: 'old@test.com',
        password: 'mypassword',
      );
    });

    test('succeeds with correct password', () async {
      final result = await auth.changeEmail(
        currentPassword: 'mypassword',
        newEmail: 'new@test.com',
      );

      expect(result, isTrue);
      expect(auth.email, 'new@test.com');

      final loginWithNewEmail = await auth.login(
        email: 'new@test.com',
        password: 'mypassword',
      );
      expect(loginWithNewEmail, isTrue);
    });

    test('fails with incorrect password', () async {
      final result = await auth.changeEmail(
        currentPassword: 'wrongpassword',
        newEmail: 'new@test.com',
      );

      expect(result, isFalse);
      expect(auth.email, 'old@test.com');
    });

    test('migrates task data to the new email key on success', () async {
      final task = TaskModel(
        id: '1',
        title: 'My task',
        time: '10:00',
        date: 'today',
      );
      await LocalStorageService().saveTasksForUser('old@test.com', [task]);

      final result = await auth.changeEmail(
        currentPassword: 'mypassword',
        newEmail: 'new@test.com',
      );

      expect(result, isTrue);
      expect(auth.email, 'new@test.com');

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('tasks_old@test.com'), isNull,
          reason: 'old key should be removed after migration');
      expect(prefs.getString('tasks_new@test.com'), isNotNull,
          reason: 'tasks should be reachable under the new email key');

      final migrated = LocalStorageService().loadTasksForUser('new@test.com');
      expect(migrated.length, 1);
      expect(migrated[0].title, 'My task');
    });

    test('does not migrate task data when the current password is wrong',
        () async {
      final task = TaskModel(
        id: '1',
        title: 'Keep me',
        time: '10:00',
        date: 'today',
      );
      await LocalStorageService().saveTasksForUser('old@test.com', [task]);

      final result = await auth.changeEmail(
        currentPassword: 'wrongpassword',
        newEmail: 'new@test.com',
      );

      expect(result, isFalse);

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('tasks_old@test.com'), isNotNull,
          reason: 'tasks stay under the old key');
      expect(prefs.getString('tasks_new@test.com'), isNull,
          reason: 'no migration should occur on a failed email change');
    });
  });

  group('legacy migration', () {
    test('migrates SharedPreferences plaintext to hash+salt', () async {
      await setupAuth(
        sharedPrefs: {
          'auth_is_logged_in': true,
          'auth_name': 'Legacy User',
          'auth_email': 'legacy@test.com',
          'auth_password': 'legacyplaintext',
        },
      );

      expect(secureStorage.containsKey('auth_password'), isFalse);
      expect(secureStorage.containsKey('auth_password_hash'), isTrue);
      expect(secureStorage.containsKey('auth_password_salt'), isTrue);

      final loginResult = await auth.login(
        email: 'legacy@test.com',
        password: 'legacyplaintext',
      );
      expect(loginResult, isTrue);
    });

    test('migrates unsalted secure-storage password to hash+salt', () async {
      await setupAuth(
        sharedPrefs: {
          'auth_is_logged_in': true,
          'auth_name': 'PreFix User',
          'auth_email': 'prefix@test.com',
        },
        securePrefs: {
          'auth_password': 'prefixplaintext',
        },
      );

      expect(secureStorage.containsKey('auth_password'), isFalse);
      expect(secureStorage.containsKey('auth_password_hash'), isTrue);
      expect(secureStorage.containsKey('auth_password_salt'), isTrue);

      final loginResult = await auth.login(
        email: 'prefix@test.com',
        password: 'prefixplaintext',
      );
      expect(loginResult, isTrue);
    });

    test('migrates through both layers (SharedPreferences → secure → hash)',
        () async {
      await setupAuth(
        sharedPrefs: {
          'auth_is_logged_in': true,
          'auth_name': 'Double Legacy',
          'auth_email': 'double@test.com',
          'auth_password': 'doubleplaintext',
        },
      );

      expect(secureStorage.containsKey('auth_password'), isFalse);
      expect(secureStorage.containsKey('auth_password_hash'), isTrue);
      expect(secureStorage.containsKey('auth_password_salt'), isTrue);

      final loginResult = await auth.login(
        email: 'double@test.com',
        password: 'doubleplaintext',
      );
      expect(loginResult, isTrue);
    });
  });

  group('updateProfile preserves password', () {
    setUp(() async {
      await setupAuth();
      await auth.signUp(
        name: 'Test User',
        email: 'test@test.com',
        password: 'mypassword',
      );
    });

    test('password still works after profile update', () async {
      await auth.updateProfile(name: 'Updated Name');

      final loginResult = await auth.login(
        email: 'test@test.com',
        password: 'mypassword',
      );
      expect(loginResult, isTrue);
      expect(auth.name, 'Updated Name');
    });
  });

  group('password_hasher utility', () {
    test('generateSalt produces different values each time', () {
      final salt1 = generateSalt();
      final salt2 = generateSalt();
      expect(salt1, isNot(equals(salt2)));
    });

    test('hashPassword produces deterministic results', () {
      final hash1 = hashPassword('mypassword', 'mysalt');
      final hash2 = hashPassword('mypassword', 'mysalt');
      expect(hash1, equals(hash2));
    });

    test('different salts produce different hashes for same password', () {
      final hash1 = hashPassword('mypassword', 'salt1');
      final hash2 = hashPassword('mypassword', 'salt2');
      expect(hash1, isNot(equals(hash2)));
    });
  });
}
