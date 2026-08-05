import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/features/auth/state/auth_provider.dart';
import 'package:tasko/features/auth/presentation/screens/login_screen.dart';
import 'package:tasko/features/todo/data/datasources/local_data_source.dart';
import 'package:tasko/features/todo/data/repositories/task_repository_impl.dart';
import 'package:tasko/features/todo/domain/repositories/task_repository.dart';
import 'package:tasko/features/todo/presentation/screens/splash_screen.dart';
import 'package:tasko/features/todo/presentation/state/settings_provider.dart';
import 'package:tasko/features/todo/presentation/state/task_provider.dart';
import 'package:tasko/features/todo/presentation/widgets/main_scaffold.dart';
import 'package:tasko/main.dart';
import 'package:tasko/shared/services/local_storage_service.dart';

import 'core/network/test_services.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late TestBackend backend;

  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;

    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (MethodCall methodCall) async => null,
    );
  });

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await LocalStorageService().init();

    backend = TestBackend((options, attempt) {
      switch ('${options.method} ${options.path}') {
        case 'GET /auth/me':
          return ok({
            'id': 'user-1',
            'email': 'test@test.com',
            'firstName': 'Test',
            'lastName': 'User',
            'role': 'USER',
            'isEmailVerified': false,
            'createdAt': '2025-01-01T00:00:00.000Z',
          });
        case 'GET /users/me':
          return ok({
            'id': 'user-1',
            'email': 'test@test.com',
            'firstName': 'Test',
            'lastName': 'User',
            'role': 'USER',
            'isEmailVerified': false,
            'createdAt': '2025-01-01T00:00:00.000Z',
            'updatedAt': '2025-01-01T00:00:00.000Z',
          });
        default:
          throw StateError('unexpected ${options.method} ${options.path}');
      }
    });
    AppServices.instance = backend.services;
  });

  Widget buildApp() {
    final localDataSource = LocalDataSource(LocalStorageService());
    final taskRepository = TaskRepositoryImpl(localDataSource) as TaskRepository;
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => TaskProvider(taskRepository)..loadTasks()),
        ChangeNotifierProvider(create: (_) => AuthProvider()..loadUser()),
        ChangeNotifierProvider(create: (_) => SettingsProvider()..loadSettings()),
      ],
      child: const MyApp(),
    );
  }

  testWidgets('app launches and shows the splash screen', (tester) async {
    await tester.pumpWidget(buildApp());
    await tester.pump();

    expect(find.byType(SplashScreen), findsOneWidget);
    expect(find.text('Tasko'), findsOneWidget);
    expect(find.text('Organize your day'), findsOneWidget);

    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();
  });

  testWidgets('splash navigates to the login screen when signed out',
      (tester) async {
    await tester.pumpWidget(buildApp());
    await tester.pump();

    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();

    expect(find.byType(SplashScreen), findsNothing);
    expect(find.byType(LoginScreen), findsOneWidget);
  });

  testWidgets('splash navigates to the main scaffold when signed in',
      (tester) async {
    backend.storage.accessToken = 'access-1';
    backend.storage.refreshToken = 'refresh-1';

    await tester.pumpWidget(buildApp());
    await tester.pump();

    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();

    expect(find.byType(SplashScreen), findsNothing);
    expect(find.byType(MainScaffold), findsOneWidget);
  });
}
