import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tasko/features/auth/presentation/screens/login_screen.dart';
import 'package:tasko/features/auth/state/auth_provider.dart';
import 'package:tasko/features/todo/domain/entities/task.dart';
import 'package:tasko/features/todo/presentation/screens/task_details_screen.dart';
import 'package:tasko/features/todo/presentation/state/settings_provider.dart';
import 'package:tasko/features/todo/presentation/state/task_provider.dart';
import 'package:tasko/features/todo/presentation/widgets/side_drawer.dart';
import 'package:tasko/shared/services/local_storage_service.dart';
import 'package:tasko/shared/services/remote_config_service.dart';

import 'core/network/test_services.dart';

/// Configurable reader so the gating flags can be flipped per test.
class _GatingReader implements RemoteConfigReader {
  _GatingReader({
    required this.collaborationEnabled,
    required this.socialJson,
  });

  final bool collaborationEnabled;
  final String socialJson;

  @override
  Future<void> setDefaults(Map<String, dynamic> defaults) async {}

  @override
  Future<bool> fetchAndActivate() async => true;

  @override
  bool getBool(String key) => collaborationEnabled;

  @override
  int getInt(String key) => 1;

  @override
  String getString(String key) => socialJson;
}

Widget _app(Widget home) {
  return MaterialApp(
    locale: const Locale('en'),
    supportedLocales: const [Locale('en'), Locale('ar'), Locale('fr')],
    localizationsDelegates: const [
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    home: ChangeNotifierProvider(
      create: (_) => SettingsProvider(
        services: TestBackend(
          (options, attempt) => throw StateError('no request expected'),
        ).services,
      ),
      child: home,
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

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
  });

  tearDown(() {
    RemoteConfigService.instance = null;
  });

  testWidgets('social login buttons show by default', (tester) async {
    await tester.pumpWidget(_app(const LoginScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Continue with Google'), findsOneWidget);
    expect(find.text('Continue with Facebook'), findsOneWidget);
  });

  testWidgets('social login buttons hide when the flag disables them',
      (tester) async {
    RemoteConfigService.instance = RemoteConfigService(
      reader: _GatingReader(
        collaborationEnabled: true,
        socialJson: '{"google":false,"apple":false,"facebook":false}',
      ),
    );

    await tester.pumpWidget(_app(const LoginScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Continue with Google'), findsNothing);
    expect(find.text('Continue with Facebook'), findsNothing);
    expect(find.text('or'), findsNothing);
  });

  testWidgets('comments entry hides when collaboration is disabled',
      (tester) async {
    final backend = TestBackend(
        (options, attempt) => throw StateError('no request expected'));
    RemoteConfigService.instance = RemoteConfigService(
      reader: _GatingReader(
        collaborationEnabled: false,
        socialJson: '{"google":true,"apple":false,"facebook":true}',
      ),
    );

    await tester.pumpWidget(ChangeNotifierProvider(
      create: (_) => TaskProvider(services: backend.services),
      child: _app(TaskDetailsScreen(
        task: Task(
          id: 't1',
          title: 'Alpha',
          time: '10:00',
          date: 'today',
          priority: 'medium',
        ),
      )),
    ));
    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.chat_bubble_outline_rounded), findsNothing);
  });

  testWidgets('my teams entry hides from the drawer when collaboration is '
      'disabled', (tester) async {
    final backend = TestBackend((options, attempt) {
      if (options.path == '/settings') {
        return ok({
          'userId': 'user-1',
          'darkMode': false,
          'notificationsEnabled': true,
          'language': 'en',
          'updatedAt': '2025-01-01T00:00:00.000Z',
        });
      }
      throw StateError('unexpected ${options.method} ${options.path}');
    });
    RemoteConfigService.instance = RemoteConfigService(
      reader: _GatingReader(
        collaborationEnabled: false,
        socialJson: '{"google":true,"apple":false,"facebook":true}',
      ),
    );

    await tester.pumpWidget(MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => AuthProvider(services: backend.services),
        ),
        ChangeNotifierProvider(
          create: (_) => SettingsProvider(services: backend.services)
            ..loadSettings(),
        ),
      ],
      child: _app(Scaffold(
        drawer: SideDrawer(onNavigate: (_) {}),
        body: const SizedBox(),
      )),
    ));
    await tester.pumpAndSettle();
    tester.state<ScaffoldState>(find.byType(Scaffold)).openDrawer();
    await tester.pumpAndSettle();

    expect(find.text('My Teams'), findsNothing);
  });
}
