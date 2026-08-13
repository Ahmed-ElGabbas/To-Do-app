import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/core/network/models/invitation.dart';
import 'package:tasko/features/collaboration/presentation/screens/invitation_accept_screen.dart';
import 'package:tasko/features/todo/presentation/state/settings_provider.dart';
import 'package:tasko/shared/services/analytics_service.dart';

import 'core/network/test_services.dart';

class _SpyAnalyticsTracker implements AnalyticsTracker {
  final events = <({String name, Map<String, Object>? parameters})>[];

  @override
  Future<void> logEvent(String name, {Map<String, Object>? parameters}) async {
    events.add((name: name, parameters: parameters));
  }
}

Map<String, dynamic> settingsJson() => {
      'userId': 'user-1',
      'darkMode': false,
      'notificationsEnabled': true,
      'language': 'en',
      'updatedAt': '2025-01-01T00:00:00.000Z',
    };

Map<String, dynamic> invitationJson({String status = 'pending'}) => {
      'id': 'inv-1',
      'teamId': 't1',
      'teamName': 'Design',
      'email': 'a@b.com',
      'role': 'editor',
      'status': status,
      'expiresAt': '2026-01-01T00:00:00.000Z',
      'createdAt': '2025-01-01T00:00:00.000Z',
    };

Invitation invitation({String status = 'pending'}) =>
    Invitation.fromJson(invitationJson(status: status));

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues({});
  });

  Widget app(TestBackend backend, Invitation inv, {String token = 'tok-1'}) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) =>
              SettingsProvider(services: backend.services)..loadSettings(),
        ),
      ],
      child: MaterialApp(
        home: InvitationAcceptScreen(token: token, invitation: inv),
      ),
    );
  }

  testWidgets('pending invitation shows team details and both actions',
      (tester) async {
    final backend = TestBackend((options, attempt) {
      if (options.path == '/settings') return ok(settingsJson());
      throw StateError('unexpected request: ${options.method} ${options.path}');
    });
    AppServices.instance = backend.services;

    await tester.pumpWidget(app(backend, invitation()));
    await tester.pumpAndSettle();

    expect(find.text('Design'), findsOneWidget);
    expect(find.text('Accept Invitation'), findsOneWidget);
    expect(find.text('Decline'), findsOneWidget);
  });

  testWidgets('accept posts to /invitations/:token/accept and confirms',
      (tester) async {
    final backend = TestBackend((options, attempt) {
      if (options.path == '/settings') return ok(settingsJson());
      expect(options.method, 'POST');
      expect(options.path, '/invitations/tok-1/accept');
      return ok(invitationJson(status: 'accepted'));
    });
    AppServices.instance = backend.services;
    final tracker = _SpyAnalyticsTracker();
    AnalyticsService.instance = AnalyticsService(tracker: tracker);
    addTearDown(() => AnalyticsService.instance = null);

    await tester.pumpWidget(app(backend, invitation()));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Accept Invitation'));
    await tester.pumpAndSettle();

    expect(find.text('You have joined the team!'), findsOneWidget);
    expect(find.text('Accept Invitation'), findsNothing);
    expect(tracker.events.single.name, 'invitation_accepted');
  });

  testWidgets('decline posts to /invitations/:token/decline and confirms',
      (tester) async {
    final backend = TestBackend((options, attempt) {
      if (options.path == '/settings') return ok(settingsJson());
      expect(options.method, 'POST');
      expect(options.path, '/invitations/tok-1/decline');
      return ok(null);
    });
    AppServices.instance = backend.services;

    await tester.pumpWidget(app(backend, invitation()));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Decline'));
    await tester.pumpAndSettle();

    expect(find.text('Invitation declined.'), findsOneWidget);
    expect(find.text('Decline'), findsNothing);
  });

  testWidgets('resolved invitation hides the action buttons', (tester) async {
    final backend = TestBackend((options, attempt) {
      if (options.path == '/settings') return ok(settingsJson());
      throw StateError('unexpected request: ${options.method} ${options.path}');
    });
    AppServices.instance = backend.services;

    await tester.pumpWidget(app(backend, invitation(status: 'accepted')));
    await tester.pumpAndSettle();

    expect(find.text('You have joined the team!'), findsOneWidget);
    expect(find.text('Accept Invitation'), findsNothing);
    expect(find.text('Decline'), findsNothing);
  });

  testWidgets('an API error is surfaced on the accept action', (tester) async {
    final backend = TestBackend((options, attempt) {
      if (options.path == '/settings') return ok(settingsJson());
      return failResponse('EXPIRED', 'This invitation has expired.',
          status: 410);
    });
    AppServices.instance = backend.services;

    await tester.pumpWidget(app(backend, invitation()));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Accept Invitation'));
    await tester.pumpAndSettle();

    expect(find.text('This invitation has expired.'), findsOneWidget);
  });
}
