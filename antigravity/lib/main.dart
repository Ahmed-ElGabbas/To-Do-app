import 'dart:async';

import 'package:firebase_app_check/firebase_app_check.dart';
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
import 'package:tasko/shared/services/app_check_service.dart';
import 'package:tasko/shared/services/crashlytics_service.dart';
import 'package:tasko/shared/services/deep_link_service.dart';
import 'package:tasko/shared/services/notification_service.dart';
import 'package:tasko/shared/services/performance_service.dart';
import 'package:tasko/shared/services/push_service.dart';
import 'package:tasko/shared/services/realtime_service.dart';
import 'package:tasko/shared/services/remote_config_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase init (Round 0: inert bootstrap, nothing wired yet).
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // App Check (Round 6): attest client integrity via Play Integrity (Android)
  // and DeviceCheck (iOS). Must run after Firebase.initializeApp() and before
  // other Firebase services. The backend is in MONITOR mode, so even a failed
  // token fetch (e.g. Play Integrity unavailable on an unregistered debug
  // build) only means requests go out without the header — never a broken
  // request.
  await FirebaseAppCheck.instance.activate(
    providerAndroid: const AndroidPlayIntegrityProvider(),
    providerApple: const AppleDeviceCheckProvider(),
  );
  AppCheckService.instance = AppCheckService();

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
  final teamProvider = TeamProvider();

  // Realtime (R6): one socket per app. The auth layer connects on login and
  // disconnects on logout; a reconnect re-fetches current state over REST
  // exactly like the FCM foreground handler (realtime plan Section 8). When a
  // handshake is rejected and the token refresh fails, the session is expired
  // and the user is signed out.
  final realtime = RealtimeService();
  RealtimeService.instance = realtime;
  realtime.onSessionExpired = () {
    unawaited(authProvider.logout());
  };
  realtime.onReconnected = () {
    if (!authProvider.isLoggedIn) return;
    taskProvider.loadTasks();
    teamProvider.loadTeams();
    notificationProvider.load();
  };

  // Realtime (R7): central dispatcher. Coarse handlers update the global
  // providers exactly like the FCM foreground closure; screen-scoped
  // subscriptions (live comments, typing, roster) register directly in
  // their initState per Section 10.2.
  realtime.onTaskEvent = taskProvider.applyRealtimeEvent;
  realtime.onPresence = teamProvider.applyPresence;
  realtime.onMemberRemoved = (_) {
    if (!authProvider.isLoggedIn) return;
    teamProvider.loadTeams();
  };
  realtime.onInvitationAccepted = (_) {
    if (!authProvider.isLoggedIn) return;
    teamProvider.loadTeams();
    notificationProvider.load();
  };

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
        ChangeNotifierProvider(create: (_) => teamProvider),
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
