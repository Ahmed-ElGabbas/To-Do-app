import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/features/auth/state/auth_provider.dart';
import 'package:tasko/features/collaboration/presentation/screens/comments_screen.dart';
import 'package:tasko/features/collaboration/presentation/screens/team_details_screen.dart';
import 'package:tasko/features/collaboration/state/team_provider.dart';
import 'package:tasko/features/todo/presentation/state/settings_provider.dart';
import 'package:tasko/shared/services/realtime_service.dart';

import 'core/network/test_services.dart';

/// Same injectable stand-in as `realtime_service_test.dart` so a live
/// [RealtimeService] can dispatch real wire events into widget trees.
class _FakeRealtimeConnection implements RealtimeConnection {
  final Map<String, List<void Function(dynamic)>> handlers = {};

  @override
  void connect() {}

  @override
  void disconnect() {}

  @override
  void emit(String event, [Object? data]) {}

  @override
  void on(String event, void Function(dynamic data) handler) =>
      (handlers[event] ??= []).add(handler);

  @override
  void onConnect(void Function() handler) {}

  @override
  void onConnectError(void Function(dynamic error) handler) {}

  @override
  void onDisconnect(void Function(dynamic reason) handler) {}

  @override
  void onError(void Function(dynamic error) handler) {}

  @override
  void dispose() {}

  void fire(String event, [dynamic data]) {
    for (final handler in List.of(handlers[event] ?? const <void Function(dynamic)>[])) {
      handler(data);
    }
  }
}

Map<String, dynamic> settingsJson() => {
      'userId': 'user-1',
      'darkMode': false,
      'notificationsEnabled': true,
      'language': 'en',
      'updatedAt': '2025-01-01T00:00:00.000Z',
    };

Map<String, dynamic> teamJson(String id, String name) => {
      'id': id,
      'name': name,
      'description': 'Team $name',
      'ownerId': 'user-1',
      'role': 'owner',
      'createdAt': '2025-01-01T00:00:00.000Z',
      'updatedAt': '2025-01-01T00:00:00.000Z',
    };

Map<String, dynamic> memberJson(String userId) => {
      'userId': userId,
      'role': 'viewer',
      'joinedAt': '2025-01-01T00:00:00.000Z',
      'user': {
        'id': userId,
        'email': '$userId@example.com',
        'firstName': 'First',
        'lastName': 'Member',
      },
    };

Map<String, dynamic> commentJson(String id, String body) => {
      'id': id,
      'taskId': 't-1',
      'userId': 'u-2',
      'body': body,
      'createdAt': '2026-01-01T10:00:00.000Z',
      'updatedAt': '2026-01-01T10:00:00.000Z',
    };

Map<String, dynamic> envelope(String event, Map<String, dynamic> payload) =>
    {
      'eventId': 'evt-1',
      'occurredAt': '2026-01-01T10:00:00.000Z',
      'actor': {'userId': 'u-2'},
      'payload': payload,
    };

var membersRequests = 0;

ResponseBody _route(RequestOptions options, int attempt) {
  final method = options.method;
  final path = options.path;
  if (path == '/settings' && method == 'GET') return ok(settingsJson());
  if (path == '/tasks/t-1/comments' && method == 'GET') {
    return ok(<dynamic>[]);
  }
  if (path == '/teams' && method == 'GET') {
    return ok([teamJson('t1', 'Design')]);
  }
  if (path == '/teams/t1/members' && method == 'GET') {
    membersRequests++;
    return ok([memberJson('u1')]);
  }
  if (path == '/teams/t1/invitations' && method == 'GET') {
    return ok(<dynamic>[]);
  }
  throw StateError('unexpected request: $method $path');
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late TestBackend backend;
  late _FakeRealtimeConnection fake;

  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues({});
    membersRequests = 0;
    backend = TestBackend(_route);
  });

  tearDown(() {
    RealtimeService.instance = null;
  });

  Future<void> wireRealtime() async {
    late _FakeRealtimeConnection created;
    final service = RealtimeService(
      services: backend.services,
      baseUrl: 'http://test.local',
      connectionFactory: (uri, options) {
        created = _FakeRealtimeConnection();
        return created;
      },
    );
    RealtimeService.instance = service;
    AppServices.instance = backend.services;
    await backend.storage.write(accessToken: 'tok', refreshToken: 'rt');
    await service.connect();
    fake = created;
  }

  Widget commentsApp() {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => SettingsProvider(services: backend.services)
            ..loadSettings(),
        ),
        ChangeNotifierProvider(
          create: (_) => AuthProvider(services: backend.services),
        ),
      ],
      child: const MaterialApp(home: CommentsScreen(taskId: 't-1')),
    );
  }

  Widget teamDetailsApp() {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => SettingsProvider(services: backend.services)
            ..loadSettings(),
        ),
        ChangeNotifierProvider(
          create: (_) => AuthProvider(services: backend.services),
        ),
        ChangeNotifierProvider(
          create: (_) => TeamProvider(services: backend.services)..loadTeams(),
        ),
      ],
      child: const MaterialApp(home: TeamDetailsScreen(teamId: 't1')),
    );
  }

  testWidgets('comments screen appends a live comment from the socket',
      (tester) async {
    await wireRealtime();
    await tester.pumpWidget(commentsApp());
    await tester.pumpAndSettle();
    expect(find.textContaining('No comments yet'), findsOneWidget);

    fake.fire('comment.added',
        envelope('comment.added', {
          'comment': commentJson('c-live', 'Live comment'),
          'task': {'id': 't-1', 'title': 'Task'},
        }));
    await tester.pump();

    expect(find.text('Live comment'), findsOneWidget);
    expect(find.textContaining('No comments yet'), findsNothing);
  });

  testWidgets('comments screen shows and clears the typing indicator',
      (tester) async {
    await wireRealtime();
    await tester.pumpWidget(commentsApp());
    await tester.pumpAndSettle();
    expect(find.text('Someone is typing…'), findsNothing);

    fake.fire('typing', envelope('typing', {
      'taskId': 't-1',
      'userId': 'u-2',
      'isTyping': true,
    }));
    await tester.pump();
    expect(find.text('Someone is typing…'), findsOneWidget);

    fake.fire('typing', envelope('typing', {
      'taskId': 't-1',
      'userId': 'u-2',
      'isTyping': false,
    }));
    await tester.pump();
    expect(find.text('Someone is typing…'), findsNothing);
  });

  testWidgets('team details shows an online dot for a present member',
      (tester) async {
    await wireRealtime();
    await tester.pumpWidget(teamDetailsApp());
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('Online'), findsNothing);

    final context = tester.element(find.byType(TeamDetailsScreen));
    final teamProvider = Provider.of<TeamProvider>(context, listen: false);
    RealtimeService.instance!.onPresence = teamProvider.applyPresence;

    fake.fire('user.online', envelope('user.online', {'userId': 'u1'}));
    await tester.pump();

    expect(teamProvider.isOnline('u1'), isTrue, reason: 'provider state');
    expect(
      find.byWidgetPredicate(
          (w) => w is Semantics && w.properties.label == 'Online'),
      findsOneWidget,
      reason: 'online dot carries the Online a11y label',
    );
  });

  testWidgets('team details reloads its roster on member.removed',
      (tester) async {
    await wireRealtime();
    await tester.pumpWidget(teamDetailsApp());
    await tester.pumpAndSettle();
    expect(membersRequests, 1);

    fake.fire('member.removed', {
      'eventId': 'evt-1',
      'occurredAt': '2026-01-01T10:00:00.000Z',
      'payload': {'teamId': 't1', 'userId': 'u1'},
    });
    await tester.pumpAndSettle();

    expect(membersRequests, 2);
  });
}
