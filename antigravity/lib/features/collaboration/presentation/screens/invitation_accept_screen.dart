import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/core/network/api_error.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/core/network/models/invitation.dart';
import 'package:tasko/features/auth/state/auth_provider.dart';
import 'package:tasko/features/collaboration/state/team_provider.dart';
import 'package:tasko/features/todo/presentation/widgets/custom_button.dart';
import 'package:tasko/shared/services/analytics_service.dart';

/// Accepts or declines an invitation reached through a magic-link deep link
/// (`https://<host>/invitations/<token>`, Round 4).
///
/// Both `POST /invitations/:token/accept` and `.../decline` are public on the
/// backend, so the screen works whether or not the user is signed in. After a
/// successful accept the team list is refreshed so the new membership shows up
/// immediately (no-op when the providers aren't mounted, e.g. widget tests).
class InvitationAcceptScreen extends StatefulWidget {
  const InvitationAcceptScreen({
    super.key,
    required this.token,
    required this.invitation,
  });

  final String token;
  final Invitation invitation;

  @override
  State<InvitationAcceptScreen> createState() => _InvitationAcceptScreenState();
}

class _InvitationAcceptScreenState extends State<InvitationAcceptScreen> {
  late Invitation _invitation;
  bool _busy = false;
  String? _errorMessage;

  bool get _resolved => !_invitation.isPending;

  @override
  void initState() {
    super.initState();
    _invitation = widget.invitation;
  }

  Future<void> _accept() async {
    setState(() {
      _busy = true;
      _errorMessage = null;
    });
    try {
      final updated = await AppServices.instance.invitationApi.accept(
        token: widget.token,
      );
      if (!mounted) return;
      setState(() {
        _invitation = updated;
        _busy = false;
      });
      AnalyticsService.invitationAccepted();
      _refreshTeamsIfLoggedIn();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.message;
        _busy = false;
      });
    }
  }

  Future<void> _decline() async {
    setState(() {
      _busy = true;
      _errorMessage = null;
    });
    try {
      await AppServices.instance.invitationApi.decline(widget.token);
      if (!mounted) return;
      setState(() {
        _invitation = Invitation(
          id: _invitation.id,
          teamId: _invitation.teamId,
          teamName: _invitation.teamName,
          email: _invitation.email,
          role: _invitation.role,
          status: 'declined',
          expiresAt: _invitation.expiresAt,
          createdAt: _invitation.createdAt,
        );
        _busy = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.message;
        _busy = false;
      });
    }
  }

  void _refreshTeamsIfLoggedIn() {
    final teamProvider = context.read<TeamProvider?>();
    final auth = context.read<AuthProvider?>();
    if (teamProvider != null && auth?.isLoggedIn == true) {
      unawaited(teamProvider.loadTeams());
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.get('invite_title'))),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSizes.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Icon(
                _resolved ? Icons.mark_email_read : Icons.mail_outline,
                size: 56,
                color: theme.primaryColor,
              ),
              const SizedBox(height: AppSizes.lg),
              Text(
                _invitation.teamName,
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: AppSizes.xs),
              Text(
                l10n.get('invite_for_email').replaceFirst(
                      '{email}',
                      _invitation.email,
                    ),
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
              const SizedBox(height: AppSizes.md),
              _DetailRow(
                label: l10n.get('invite_role'),
                value: switch (_invitation.role) {
                  'owner' => l10n.get('owner'),
                  'editor' => l10n.get('editor'),
                  _ => l10n.get('viewer'),
                },
              ),
              _DetailRow(
                label: l10n.get('invite_expires'),
                value: _formatExpiry(_invitation.expiresAt),
              ),
              const SizedBox(height: AppSizes.lg),
              if (_errorMessage != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSizes.md),
                  child: Text(
                    _errorMessage!,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: theme.colorScheme.error),
                  ),
                ),
              if (_resolved)
                _StatusCard(status: _invitation.status)
              else ...[
                CustomButton(
                  text: l10n.get('invite_accept'),
                  icon: Icons.check,
                  isLoading: _busy,
                  onPressed: _accept,
                ),
                const SizedBox(height: AppSizes.sm),
                CustomButton(
                  text: l10n.get('invite_decline'),
                  icon: Icons.close,
                  isOutlined: true,
                  isLoading: _busy,
                  onPressed: _decline,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _formatExpiry(DateTime expiresAt) {
    final local = expiresAt.toLocal();
    final month = local.month.toString().padLeft(2, '0');
    final day = local.day.toString().padLeft(2, '0');
    return '$day/$month/${local.year}';
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSizes.xs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
            ),
          ),
          const SizedBox(width: AppSizes.sm),
          Text(
            value,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final message = switch (status) {
      'accepted' => l10n.get('invite_accepted'),
      'declined' => l10n.get('invite_declined'),
      _ => l10n.get('invite_not_pending'),
    };
    return Container(
      padding: const EdgeInsets.all(AppSizes.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.secondaryContainer.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(AppSizes.buttonRadius),
      ),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: theme.textTheme.bodyMedium,
      ),
    );
  }
}
