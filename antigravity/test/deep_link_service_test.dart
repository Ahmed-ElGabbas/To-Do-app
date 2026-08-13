import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/shared/services/deep_link_service.dart';

import 'core/network/test_services.dart';

/// Injectable stand-in for the `app_links` plugin so warm/cold start states can
/// be driven deterministically (the plugin cannot be built in unit tests).
class FakeDeepLinkReceiver implements DeepLinkReceiver {
  final linkController = StreamController<Uri>.broadcast();
  Uri? initial;

  @override
  Future<Uri?> getInitialLink() async => initial;

  @override
  Stream<Uri> get linkStream => linkController.stream;
}

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

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('invitationToken extracts the token from /invitations/<token>', () {
    expect(
      DeepLinkService.invitationToken(
        Uri.parse('https://tasko.app/invitations/abc123'),
      ),
      'abc123',
    );
    expect(
      DeepLinkService.invitationToken(Uri.parse('https://tasko.app/other/abc')),
      isNull,
    );
    expect(
      DeepLinkService.invitationToken(
        Uri.parse('https://tasko.app/invitations/'),
      ),
      isNull,
    );
  });

  test('warm-start link opens the invitation immediately', () async {
    final receiver = FakeDeepLinkReceiver();
    final opened = <String>[];
    final backend = TestBackend(
        (options, attempt) => throw StateError('no request expected'));
    final service = DeepLinkService(
      services: backend.services,
      receiver: receiver,
      invitationOpener: (token) async => opened.add(token),
    );

    await service.init();
    receiver.linkController.add(
      Uri.parse('https://tasko.app/invitations/tok-1'),
    );
    await pumpEventQueue();

    expect(opened, ['tok-1']);
  });

  test('cold-start link is deferred until flushed, then consumed once',
      () async {
    final receiver = FakeDeepLinkReceiver()
      ..initial = Uri.parse('https://tasko.app/invitations/tok-cold');
    final opened = <String>[];
    final backend = TestBackend(
        (options, attempt) => throw StateError('no request expected'));
    final service = DeepLinkService(
      services: backend.services,
      receiver: receiver,
      invitationOpener: (token) async => opened.add(token),
    );

    await service.init();
    expect(opened, isEmpty);

    await service.flushPendingRoute();
    expect(opened, ['tok-cold']);

    await service.flushPendingRoute();
    expect(opened, ['tok-cold']);
  });

  test('links that are not invitations are ignored', () async {
    final receiver = FakeDeepLinkReceiver();
    final opened = <String>[];
    final backend = TestBackend(
        (options, attempt) => throw StateError('no request expected'));
    final service = DeepLinkService(
      services: backend.services,
      receiver: receiver,
      invitationOpener: (token) async => opened.add(token),
    );

    await service.init();
    receiver.linkController.add(Uri.parse('https://tasko.app/tasks/t1'));
    await pumpEventQueue();

    expect(opened, isEmpty);
  });

  test('openInvitation fetches the invitation from the backend', () async {
    final backend = TestBackend((options, attempt) {
      expect(options.method, 'GET');
      expect(options.path, '/invitations/tok-api');
      return ok(invitationJson());
    });
    final service = DeepLinkService(
      services: backend.services,
      receiver: FakeDeepLinkReceiver(),
    );

    // No navigator in a pure unit test, so this verifies the fetch happens and
    // navigation is skipped without error.
    await service.openInvitation('tok-api');
  });

  test('openInvitation swallows ApiException for unknown invitations',
      () async {
    final backend = TestBackend((options, attempt) =>
        failResponse('NOT_FOUND', 'no such invitation', status: 404));
    final service = DeepLinkService(
      services: backend.services,
      receiver: FakeDeepLinkReceiver(),
    );

    await expectLater(service.openInvitation('tok-x'), completes);
  });
}
