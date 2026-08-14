import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/core/network/models/invitation.dart';
import 'package:tasko/core/network/models/member.dart';
import 'package:tasko/core/network/models/team.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/features/auth/state/auth_provider.dart';
import 'package:tasko/features/collaboration/state/team_provider.dart';
import 'package:tasko/shared/services/realtime_service.dart';

class TeamDetailsScreen extends StatefulWidget {
  final String teamId;

  const TeamDetailsScreen({super.key, required this.teamId});

  @override
  State<TeamDetailsScreen> createState() => _TeamDetailsScreenState();
}

class _TeamDetailsScreenState extends State<TeamDetailsScreen> {
  List<TeamMember> _members = [];
  List<Invitation> _invitations = [];
  bool _isLoading = true;
  VoidCallback? _memberRemovedUnsub;

  @override
  void initState() {
    super.initState();
    _load();
    // R7: keep the roster live when a teammate is removed (Section 10.2).
    _memberRemovedUnsub = RealtimeService.instance?.subscribeMemberRemoved((e) {
      if (e.payload['teamId'] == widget.teamId) _load();
    });
  }

  @override
  void dispose() {
    _memberRemovedUnsub?.call();
    super.dispose();
  }

  Future<void> _load() async {
    final provider = context.read<TeamProvider>();
    final results = await Future.wait([
      provider.members(widget.teamId),
      provider.invitations(widget.teamId),
    ]);
    if (!mounted) return;
    setState(() {
      _members = results[0] as List<TeamMember>;
      _invitations = results[1] as List<Invitation>;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    final provider = context.watch<TeamProvider>();
    final team = provider.teams.where((t) => t.id == widget.teamId).firstOrNull;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: theme.appBarTheme.backgroundColor,
        title: Text(
          team?.name ?? l10n.get('teams'),
          style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: Icon(Icons.person_add_alt_1_rounded, color: theme.primaryColor),
            onPressed: team != null && team.canEdit
                ? () => _showInviteSheet(context, provider)
                : null,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(AppSizes.md),
                children: [
                  if (team?.description case final description?
                      when description.isNotEmpty)
                    _buildSection(
                      context,
                      icon: Icons.info_outline_rounded,
                      child: Text(
                        description,
                        style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface),
                      ),
                    ),
                  const SizedBox(height: AppSizes.md),
                  _buildSectionHeader(context, l10n.get('members'), _members.length),
                  const SizedBox(height: AppSizes.sm),
                  if (_members.isEmpty)
                    _buildEmptyHint(context, l10n.get('no_members'))
                  else
                    ..._members.map((m) => _buildMemberTile(context, provider, team, m)),
                  const SizedBox(height: AppSizes.lg),
                  _buildSectionHeader(context, l10n.get('invitations'), _invitations.length),
                  const SizedBox(height: AppSizes.sm),
                  if (_invitations.isEmpty)
                    _buildEmptyHint(context, l10n.get('no_invitations'))
                  else
                    ..._invitations.map((inv) => _buildInvitationTile(context, provider, team, inv)),
                  const SizedBox(height: AppSizes.xxl),
                ],
              ),
            ),
    );
  }

  Widget _buildSection(BuildContext context, {required IconData icon, required Widget child}) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSizes.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppSizes.radiusLg),
      ),
      child: Row(
        children: [
          Icon(icon, color: theme.primaryColor, size: AppSizes.iconMd),
          const SizedBox(width: AppSizes.md),
          Expanded(child: child),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(BuildContext context, String title, int count) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Text(title, style: AppTextStyles.sectionTitle.copyWith(color: theme.colorScheme.onSurface)),
        const SizedBox(width: AppSizes.sm),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: AppSizes.sm, vertical: AppSizes.xs),
          decoration: BoxDecoration(
            color: theme.primaryColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(AppSizes.radiusFull),
          ),
          child: Text('$count', style: AppTextStyles.caption.copyWith(color: theme.primaryColor, fontWeight: FontWeight.w600)),
        ),
      ],
    );
  }

  Widget _buildEmptyHint(BuildContext context, String message) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSizes.md),
      child: Text(
        message,
        style: AppTextStyles.bodySmall.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
      ),
    );
  }

  Widget _buildMemberTile(
    BuildContext context,
    TeamProvider provider,
    TeamWithRole? team,
    TeamMember member,
  ) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    final auth = context.watch<AuthProvider>();
    final isSelf = auth.profile?.id == member.userId;
    final canManage = team?.canEdit ?? false;

    return Container(
      margin: const EdgeInsets.only(bottom: AppSizes.sm),
      padding: const EdgeInsets.all(AppSizes.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppSizes.radiusMd),
      ),
      child: Row(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: theme.primaryColor.withValues(alpha: 0.1),
                child: Text(
                  member.user.displayName.isNotEmpty
                      ? member.user.displayName[0].toUpperCase()
                      : '?',
                  style: GoogleFonts.poppins(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: theme.primaryColor,
                  ),
                ),
              ),
              Positioned(
                right: -2,
                bottom: -2,
                child: Semantics(
                  label: provider.isOnline(member.userId)
                      ? l10n.get('online')
                      : l10n.get('offline'),
                  child: Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: provider.isOnline(member.userId)
                          ? Colors.green
                          : theme.colorScheme.onSurface.withValues(alpha: 0.25),
                      border: Border.all(
                        color: theme.colorScheme.surface,
                        width: 2,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: AppSizes.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isSelf
                      ? '${member.user.displayName} (${l10n.get('you')})'
                      : member.user.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodyMedium.copyWith(
                    color: theme.colorScheme.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  member.user.email,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.caption.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
                ),
              ],
            ),
          ),
          _RoleBadge(label: _roleLabel(l10n, member.role), isOwner: member.isOwner),
          if (canManage && !member.isOwner && !isSelf)
            PopupMenuButton<String>(
              icon: Icon(Icons.more_vert_rounded, color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
              color: theme.colorScheme.surface,
              onSelected: (value) async {
                if (value == 'editor' || value == 'viewer') {
                  final ok = await provider.changeMemberRole(
                    teamId: widget.teamId,
                    userId: member.userId,
                    role: value,
                  );
                  if (ok && mounted) _load();
                } else if (value == 'remove') {
                  final ok = await provider.removeMember(
                    teamId: widget.teamId,
                    userId: member.userId,
                  );
                  if (ok && mounted) _load();
                }
              },
              itemBuilder: (ctx) => [
                PopupMenuItem(value: 'editor', child: Text(l10n.get('editor'))),
                PopupMenuItem(value: 'viewer', child: Text(l10n.get('viewer'))),
                PopupMenuItem(value: 'remove', child: Text(l10n.get('remove'))),
              ],
            ),
        ],
      ),
    );
  }

  Widget _buildInvitationTile(
    BuildContext context,
    TeamProvider provider,
    TeamWithRole? team,
    Invitation invitation,
  ) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    final canManage = team?.canEdit ?? false;

    return Container(
      margin: const EdgeInsets.only(bottom: AppSizes.sm),
      padding: const EdgeInsets.all(AppSizes.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppSizes.radiusMd),
      ),
      child: Row(
        children: [
          Icon(Icons.mail_outline_rounded, color: theme.primaryColor),
          const SizedBox(width: AppSizes.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  invitation.email,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface),
                ),
                Text(
                  _roleLabel(l10n, invitation.role),
                  style: AppTextStyles.caption.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
                ),
              ],
            ),
          ),
          _statusBadge(context, invitation),
          if (invitation.isPending && canManage)
            IconButton(
              icon: Icon(Icons.close_rounded, color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
              onPressed: () async {
                final ok = await provider.revokeInvitation(
                  teamId: widget.teamId,
                  id: invitation.id,
                );
                if (ok && mounted) _load();
              },
            ),
        ],
      ),
    );
  }

  Widget _statusBadge(BuildContext context, Invitation invitation) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    final (Color color, String label) = switch (invitation.status) {
      'pending' => (theme.primaryColor, l10n.get('pending')),
      'accepted' => (Colors.green, l10n.get('accepted')),
      'declined' => (Colors.redAccent, l10n.get('declined')),
      _ => (
          theme.colorScheme.onSurface.withValues(alpha: 0.4),
          l10n.get('revoked'),
        ),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSizes.sm, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppSizes.radiusFull),
      ),
      child: Text(
        label,
        style: GoogleFonts.poppins(fontSize: 11, fontWeight: FontWeight.w600, color: color),
      ),
    );
  }

  void _showInviteSheet(BuildContext context, TeamProvider provider) {
    final l10n = AppLocalizations.read(context);
    final theme = Theme.of(context);
    final emailController = TextEditingController();
    var role = 'viewer';
    var sending = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: theme.colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppSizes.radiusXl)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: AppSizes.lg,
            right: AppSizes.lg,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + AppSizes.lg,
            top: AppSizes.lg,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.get('invite_member'),
                style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface),
              ),
              const SizedBox(height: AppSizes.md),
              TextField(
                controller: emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  labelText: l10n.get('email'),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusSm)),
                ),
              ),
              const SizedBox(height: AppSizes.md),
              DropdownButtonFormField<String>(
                initialValue: role,
                decoration: InputDecoration(
                  labelText: l10n.get('role'),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusSm)),
                ),
                items: [
                  DropdownMenuItem(value: 'editor', child: Text(l10n.get('editor'))),
                  DropdownMenuItem(value: 'viewer', child: Text(l10n.get('viewer'))),
                ],
                onChanged: (value) => setSheetState(() => role = value ?? 'viewer'),
              ),
              const SizedBox(height: AppSizes.lg),
              SizedBox(
                width: double.infinity,
                height: 46,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: theme.primaryColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSizes.radiusFull)),
                  ),
                  onPressed: sending
                      ? null
                      : () async {
                          setSheetState(() => sending = true);
                          final ok = await provider.createInvitation(
                            teamId: widget.teamId,
                            email: emailController.text.trim(),
                            role: role,
                          );
                          if (ctx.mounted) Navigator.of(ctx).pop();
                          if (ok && mounted) _load();
                        },
                  child: Text(
                    l10n.get('invite'),
                    style: AppTextStyles.labelLarge.copyWith(color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _roleLabel(AppLocalizations l10n, String role) {
    switch (role) {
      case 'owner':
        return l10n.get('owner');
      case 'editor':
        return l10n.get('editor');
      default:
        return l10n.get('viewer');
    }
  }
}

class _RoleBadge extends StatelessWidget {
  const _RoleBadge({required this.label, required this.isOwner});

  final String label;
  final bool isOwner;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = isOwner ? theme.primaryColor : theme.colorScheme.secondary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSizes.sm, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppSizes.radiusFull),
      ),
      child: Text(
        label,
        style: GoogleFonts.poppins(fontSize: 11, fontWeight: FontWeight.w600, color: color),
      ),
    );
  }
}
