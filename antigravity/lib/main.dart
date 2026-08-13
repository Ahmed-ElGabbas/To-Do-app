import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/core/theme/app_theme.dart';
import 'package:tasko/features/todo/presentation/state/task_provider.dart';
import 'package:tasko/features/todo/presentation/state/settings_provider.dart';
import 'package:tasko/features/auth/state/auth_provider.dart';
import 'package:tasko/features/collaboration/state/team_provider.dart';
import 'package:tasko/features/collaboration/state/notification_provider.dart';
import 'package:tasko/features/collaboration/state/analytics_provider.dart';
import 'package:tasko/features/collaboration/state/activity_provider.dart';
import 'package:tasko/features/collaboration/state/admin_provider.dart';
import 'package:tasko/features/todo/presentation/screens/splash_screen.dart';
import 'package:tasko/firebase_options.dart';
import 'package:tasko/shared/services/analytics_service.dart';
import 'package:tasko/shared/services/crashlytics_service.dart';
import 'package:tasko/shared/services/deep_link_service.dart';
import 'package:tasko/shared/services/notification_service.dart';
import 'package:tasko/shared/services/performance_service.dart';
import 'package:tasko/shared/services/push_service.dart';
import 'package:tasko/shared/services/remote_config_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase init (Round 0: inert bootstrap, nothing wired yet).
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // Crashlytics: install fatal-error handlers (Round 3).
  await CrashlyticsService.init();

  // Performance: named traces around task load / search / avatar upload.
  PerformanceService.instance = PerformanceService();

  // Remote Config (Round 5): serve backend-matching defaults immediately and
  // refresh in the background — the fetch never blocks startup.
  final remoteConfig = RemoteConfigService();
  RemoteConfigService.instance = remoteConfig;
  unawaited(remoteConfig.load());

  // Analytics (Round 5): aggregate product-usage events, no-op in tests.
  AnalyticsService.instance = AnalyticsService();

  // Fix black nav bar
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    systemNavigationBarColor: Colors.white,
    systemNavigationBarIconBrightness: Brightness.dark,
  ));

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

  final taskProvider = TaskProvider()..loadTasks();
  final authProvider = AuthProvider()..loadUser();
  final notificationProvider = NotificationProvider();

  // FCM: register handlers + device token, and keep the in-app feed in sync
  // when a push arrives while the app is foregrounded.
  final push = PushService();
  PushService.instance = push;
  await push.init();
  push.onForegroundMessage = () {
    if (!authProvider.isLoggedIn) return;
    notificationProvider.load();
    taskProvider.loadTasks();
  };

  // Magic-link deep links (Round 4): subscribe to /invitations/<token> and
  // buffer any link that arrives before navigation is ready.
  final deepLink = DeepLinkService();
  DeepLinkService.instance = deepLink;
  deepLink.init();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => taskProvider),
        ChangeNotifierProvider(create: (_) => authProvider),
        ChangeNotifierProvider(create: (_) => SettingsProvider()..loadSettings()),
        ChangeNotifierProvider(create: (_) => TeamProvider()),
        ChangeNotifierProvider(create: (_) => notificationProvider),
        ChangeNotifierProvider(create: (_) => AnalyticsProvider()),
        ChangeNotifierProvider(create: (_) => ActivityProvider()),
        ChangeNotifierProvider(create: (_) => AdminProvider()),
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
          navigatorKey: PushService.navigatorKey,
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
