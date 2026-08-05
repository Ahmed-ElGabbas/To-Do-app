import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tasko/features/collaboration/presentation/screens/teams_screen.dart';
import 'package:tasko/features/collaboration/presentation/screens/notifications_screen.dart';
import 'package:tasko/features/collaboration/state/team_provider.dart';
import 'package:tasko/features/collaboration/state/notification_provider.dart';
import 'package:tasko/features/todo/presentation/state/settings_provider.dart';

import 'core/network/test_services.dart';

Map<String, dynamic> teamJson(String id, String name) => {
      'id': id,
      'name': name,
      'description': 'Team $name',
      'ownerId': 'user-1',
      'role': 'owner',
      'createdAt': '2025-01-01T00:00:00.000Z',
      'updatedAt': '2025-01-01T00:00:00.000Z',
    };

Map<String, dynamic> settingsJson() => {
      'userId': 'user-1',
      'darkMode': false,
      'notificationsEnabled': true,
      'language': 'en',
      'updatedAt': '2025-01-01T00:00:00.000Z',
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues({});
  });

  Widget teamsApp(TestBackend backend) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => SettingsProvider(services: backend.services)..loadSettings(),
        ),
        ChangeNotifierProvider(
          create: (_) => TeamProvider(services: backend.services)..loadTeams(),
        ),
      ],
      child: MaterialApp(home: const TeamsScreen()),
    );
  }

  testWidgets('teams screen lists the user teams', (tester) async {
    final backend = TestBackend((options, attempt) {
      if (options.path == '/settings') return ok(settingsJson());
      expect(options.method, 'GET');
      expect(options.path, '/teams');
      return ok([teamJson('t1', 'Design'), teamJson('t2', 'Mobile')]);
    });

    await tester.pumpWidget(teamsApp(backend));
    await tester.pumpAndSettle();

    expect(find.text('Design'), findsOneWidget);
    expect(find.text('Mobile'), findsOneWidget);
  });

  testWidgets('teams screen shows an empty state', (tester) async {
    final backend = TestBackend((options, attempt) {
      if (options.path == '/settings') return ok(settingsJson());
      expect(options.path, '/teams');
      return ok(<dynamic>[]);
    });

    await tester.pumpWidget(teamsApp(backend));
    await tester.pumpAndSettle();

    expect(find.textContaining('No teams yet'), findsOneWidget);
  });

  testWidgets('creating a team posts and updates the list', (tester) async {
    final backend = TestBackend((options, attempt) {
      if (options.path == '/settings') return ok(settingsJson());
      if (options.method == 'GET') return ok(<dynamic>[]);
      expect(options.method, 'POST');
      expect(options.path, '/teams');
      return ok(teamJson('t-new', 'Backend'));
    });

    await tester.pumpWidget(teamsApp(backend));
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.add_rounded));
    await tester.pumpAndSettle();

    expect(find.text('Create Team'), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, 'Backend');
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(find.text('Backend'), findsOneWidget);
  });

  Widget notificationsApp(TestBackend backend) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => SettingsProvider(services: backend.services)..loadSettings(),
        ),
        ChangeNotifierProvider(
          create: (_) => NotificationProvider(services: backend.services)..load(),
        ),
      ],
      child: MaterialApp(home: const NotificationsScreen()),
    );
  }

  testWidgets('notifications screen shows the inbox and marks all read',
      (tester) async {
    var readAllCalled = false;
    final backend = TestBackend((options, attempt) {
      if (options.path == '/settings') return ok(settingsJson());
      if (options.method == 'POST') {
        readAllCalled = true;
        return ok({'updated': 2});
      }
      expect(options.method, 'GET');
      expect(options.path, '/notifications');
      return ok({
        'items': [
          {
            'id': 'n1',
            'type': 'task_assigned',
            'title': 'Assigned',
            'body': 'You were assigned a task',
            'data': null,
            'isRead': false,
            'readAt': null,
            'createdAt': '2025-01-01T00:00:00.000Z',
          },
          {
            'id': 'n2',
            'type': 'team_invite',
            'title': 'Invited',
            'body': 'Join the team',
            'data': null,
            'isRead': true,
            'readAt': '2025-01-02T00:00:00.000Z',
            'createdAt': '2025-01-01T00:00:00.000Z',
          },
        ],
        'total': 2,
      });
    });

    await tester.pumpWidget(notificationsApp(backend));
    await tester.pumpAndSettle();

    expect(find.text('Assigned'), findsOneWidget);
    expect(find.text('Invited'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.done_all_rounded));
    await tester.pumpAndSettle();

    expect(readAllCalled, isTrue);
  });
}
