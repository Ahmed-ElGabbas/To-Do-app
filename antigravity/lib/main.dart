import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/core/theme/app_theme.dart';
import 'package:tasko/features/todo/data/datasources/local_data_source.dart';
import 'package:tasko/features/todo/data/repositories/task_repository_impl.dart';
import 'package:tasko/features/todo/domain/repositories/task_repository.dart';
import 'package:tasko/features/todo/presentation/state/task_provider.dart';
import 'package:tasko/features/todo/presentation/state/settings_provider.dart';
import 'package:tasko/features/auth/state/auth_provider.dart';
import 'package:tasko/features/todo/presentation/screens/splash_screen.dart';
import 'package:tasko/shared/services/local_storage_service.dart';
import 'package:tasko/shared/services/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Fix black nav bar
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    systemNavigationBarColor: Colors.white,
    systemNavigationBarIconBrightness: Brightness.dark,
  ));

  // MUST be awaited before TaskProvider is created.
  // LocalStorageService is a singleton — this one init() call
  // initialises the SharedPreferences instance used by ALL providers.
  await LocalStorageService().init();

  // Init notifications (best-effort)
  await NotificationService.init();

  // Build the network layer and wire the silent token refresh flow.
  AppServices.instance = AppServices();
  AppServices.instance.apiClient.refreshCallback = () async {
    final refreshToken = await AppServices.instance.tokenStore.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      throw StateError('No refresh token');
    }
    final tokens = await AppServices.instance.authApi.refresh(refreshToken);
    await AppServices.instance.tokenStore.write(
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    );
    return (accessToken: tokens.accessToken, refreshToken: tokens.refreshToken);
  };
  AppServices.instance.apiClient.onSessionExpired = () async {
    await AppServices.instance.tokenStore.clear();
  };

  // Wire Clean Architecture dependencies
  final localDataSource = LocalDataSource(LocalStorageService());
  final taskRepository = TaskRepositoryImpl(localDataSource) as TaskRepository;

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => TaskProvider(taskRepository)..loadTasks()),
        ChangeNotifierProvider(create: (_) => AuthProvider()..loadUser()),
        ChangeNotifierProvider(create: (_) => SettingsProvider()..loadSettings()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<SettingsProvider>(
      builder: (context, settings, _) {
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          title: 'Tasko',
          theme: AppTheme.light,
          darkTheme: AppTheme.dark,
          themeMode: settings.isDarkMode ? ThemeMode.dark : ThemeMode.light,
          locale: Locale(settings.language),
          supportedLocales: const [
            Locale('en'),
            Locale('ar'),
            Locale('fr'),
          ],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: const SplashScreen(),
        );
      },
    );
  }
}
