import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:tasko/core/network/api_error.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/features/collaboration/presentation/screens/invitation_accept_screen.dart';
import 'package:tasko/shared/services/push_service.dart';

/// Thin, injectable facade over the `app_links` plugin so [DeepLinkService]
/// stays unit testable (the plugin cannot be constructed in tests).
abstract class DeepLinkReceiver {
  Future<Uri?> getInitialLink();

  Stream<Uri> get linkStream;
}

/// Real `app_links` implementation backed by the platform's intent filters
/// (Android App Links / iOS Universal Links).
class AppLinksDeepLinkReceiver implements DeepLinkReceiver {
  final AppLinks _links = AppLinks();

  @override
  Future<Uri?> getInitialLink() => _links.getInitialLink();

  @override
  Stream<Uri> get linkStream => _links.uriLinkStream;
}

/// Opens the relevant screen for an invitation deep link. Defaults to pushing
/// [InvitationAcceptScreen]; [invitationOpener] can inject a spy in tests.
typedef InvitationOpener = Future<void> Function(String token);

/// Owns the invitation deep-link integration (Round 4).
///
/// Invitation magic links have the shape `https://<host>/invitations/<token>`.
/// When the OS routes one into the app (Android App Links / iOS Universal
/// Links) it lands here. The two startup states are handled like FCM:
/// * Warm start — the OS delivers the link via [DeepLinkReceiver.linkStream]
///   and [invitationOpener] navigates immediately.
/// * Terminated — `getInitialLink()` is read at startup and the route is
///   deferred via [flushPendingRoute] until the session is restored.
///
/// Acceptance itself needs no JWT (`POST /invitations/:token/accept` is public
/// on the backend); the screen just requires a reachable network layer.
class DeepLinkService {
  DeepLinkService({
    AppServices? services,
    DeepLinkReceiver? receiver,
    InvitationOpener? invitationOpener,
  })  : _services = services ?? AppServices.instance,
        _receiver = receiver ?? AppLinksDeepLinkReceiver(),
        _invitationOpener = invitationOpener ?? _defaultInvitationOpener;

  /// Set once in `main.dart`; the splash hook no-ops when null (e.g. widget
  /// tests).
  static DeepLinkService? instance;

  /// Root navigator used to open screens from outside the widget tree. Shares
  /// [PushService.navigatorKey] so both services push onto the app's one
  /// navigator.
  static GlobalKey<NavigatorState> get navigatorKey =>
      PushService.navigatorKey;

  final AppServices _services;
  final DeepLinkReceiver _receiver;
  final InvitationOpener _invitationOpener;

  Uri? _pendingLink;

  /// Registers the deep-link handler and captures a cold-start link. Call once
  /// at startup, after the network layer is available.
  Future<void> init() async {
    _receiver.linkStream.listen(_handleLink);

    final initial = await _receiver.getInitialLink();
    if (initial != null) {
      _pendingLink = initial;
    }
  }

  /// Consumes a cold-start (`getInitialLink`) deep link after the session is
  /// restored and the main scaffold is on screen.
  Future<void> flushPendingRoute() async {
    final link = _pendingLink;
    _pendingLink = null;
    if (link == null) return;
    await _handleLink(link);
  }

  Future<void> _handleLink(Uri link) async {
    final token = invitationToken(link);
    if (token == null) return;
    try {
      await _invitationOpener(token);
    } catch (e) {
      debugPrint('DeepLinkService: failed to open invitation: $e');
    }
  }

  static Future<void> _defaultInvitationOpener(String token) =>
      DeepLinkService.instance?.openInvitation(token) ?? Future<void>.value();

  /// Fetches the invitation for [token] and pushes its accept screen on the
  /// root navigator.
  Future<void> openInvitation(String token) async {
    try {
      final invitation = await _services.invitationApi.getByToken(token);
      final navigator = navigatorKey.currentState;
      if (navigator == null) return;
      navigator.push(
        MaterialPageRoute(
          builder: (_) => InvitationAcceptScreen(
            token: token,
            invitation: invitation,
          ),
        ),
      );
    } on ApiException {
      // Unknown, resolved or expired invitation; a missed deep link is
      // harmless.
    }
  }

  /// Extracts the invitation token from a link of the shape
  /// `https://<host>/invitations/<token>`. Returns null for anything else.
  static String? invitationToken(Uri link) {
    final segments = link.pathSegments;
    if (segments.length == 2 && segments[0] == 'invitations') {
      final token = segments[1];
      return token.isEmpty ? null : token;
    }
    return null;
  }
}
