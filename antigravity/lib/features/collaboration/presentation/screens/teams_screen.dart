import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/core/network/models/team.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/features/collaboration/presentation/screens/team_details_screen.dart';
import 'package:tasko/features/collaboration/state/team_provider.dart';

class TeamsScreen extends StatefulWidget {
  const TeamsScreen({super.key});

  @override
  State<TeamsScreen> createState() => _TeamsScreenState();
}

class _TeamsScreenState extends State<TeamsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<TeamProvider>().loadTeams();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: theme.appBarTheme.backgroundColor,
        title: Text(
          l10n.get('my_teams'),
          style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: Icon(Icons.add_rounded, color: theme.primaryColor),
            onPressed: () => _showCreateSheet(context),
          ),
        ],
      ),
      body: Consumer<TeamProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading && provider.teams.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }
          if (provider.teams.isEmpty) {
            return _buildEmptyState(context, l10n.get('no_teams'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(AppSizes.md),
            itemCount: provider.teams.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSizes.sm),
            itemBuilder: (context, index) {
              final team = provider.teams[index];
              final isActive = team.id == provider.activeTeamId;
              return _TeamCard(
                teamName: team.name,
                description: team.description,
                roleLabel: _roleLabel(l10n, team.role),
                isOwner: team.isOwner,
                isActive: isActive,
                onTap: () async {
                  provider.selectTeam(team.id);
                  await Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => TeamDetailsScreen(teamId: team.id),
                    ),
                  );
                },
                onEdit: team.canEdit
                    ? () => _showEditSheet(context, provider, team)
                    : null,
                onDelete: team.isOwner
                    ? () => _confirmDelete(context, provider, team)
                    : null,
              );
            },
          );
        },
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

  Widget _buildEmptyState(BuildContext context, String message) {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.groups_rounded, size: 56, color: theme.colorScheme.onSurface.withValues(alpha: 0.2)),
          const SizedBox(height: AppSizes.sm),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSizes.xl),
            child: Text(
              message,
              textAlign: TextAlign.center,
              style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
            ),
          ),
        ],
      ),
    );
  }

  void _showCreateSheet(BuildContext context) {
    _showTeamFormSheet(context, null);
  }

  void _showEditSheet(
    BuildContext context,
    TeamProvider provider,
    TeamWithRole team,
  ) {
    _showTeamFormSheet(context, team);
  }

  void _showTeamFormSheet(BuildContext context, TeamWithRole? team) {
    final l10n = AppLocalizations.read(context);
    final theme = Theme.of(context);
    final nameController = TextEditingController(text: team?.name ?? '');
    final descriptionController =
        TextEditingController(text: team?.description ?? '');
    var saving = false;

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
                team == null ? l10n.get('create_team') : l10n.get('edit'),
                style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface),
              ),
              const SizedBox(height: AppSizes.md),
              TextField(
                controller: nameController,
                decoration: InputDecoration(
                  labelText: l10n.get('team_name'),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusSm)),
                ),
              ),
              const SizedBox(height: AppSizes.md),
              TextField(
                controller: descriptionController,
                decoration: InputDecoration(
                  labelText: l10n.get('team_description'),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusSm)),
                ),
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
                  onPressed: saving
                      ? null
                      : () async {
                          setSheetState(() => saving = true);
                          final provider = context.read<TeamProvider>();
                          if (team == null) {
                            await provider.createTeam(
                              name: nameController.text.trim(),
                              description: descriptionController.text.trim(),
                            );
                          } else {
                            await provider.updateTeam(
                              teamId: team.id,
                              name: nameController.text.trim(),
                              description: descriptionController.text.trim(),
                            );
                          }
                          if (ctx.mounted) Navigator.of(ctx).pop();
                        },
                  child: Text(
                    l10n.get('save'),
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

  void _confirmDelete(BuildContext context, TeamProvider provider, TeamWithRole team) {
    final l10n = AppLocalizations.read(context);
    final theme = Theme.of(context);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: theme.colorScheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd)),
        title: Text(l10n.get('delete_team'), style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface)),
        content: Text(l10n.get('delete_team_confirm'), style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(l10n.get('cancel'), style: AppTextStyles.labelLarge.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5))),
          ),
          TextButton(
            onPressed: () async {
              await provider.deleteTeam(team.id);
              if (ctx.mounted) Navigator.of(ctx).pop();
            },
            child: Text(l10n.get('delete'), style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}

class _TeamCard extends StatelessWidget {
  const _TeamCard({
    required this.teamName,
    required this.description,
    required this.roleLabel,
    required this.isOwner,
    required this.isActive,
    required this.onTap,
    this.onEdit,
    this.onDelete,
  });

  final String teamName;
  final String? description;
  final String roleLabel;
  final bool isOwner;
  final bool isActive;
  final VoidCallback onTap;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(AppSizes.radiusLg),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppSizes.radiusLg),
        child: Container(
          padding: const EdgeInsets.all(AppSizes.md),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppSizes.radiusLg),
            border: Border.all(
              color: isActive ? theme.primaryColor : theme.dividerColor,
              width: isActive ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: theme.primaryColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppSizes.radiusMd),
                ),
                child: Icon(Icons.groups_rounded, color: theme.primaryColor),
              ),
              const SizedBox(width: AppSizes.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      teamName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.bodyLarge.copyWith(
                        color: theme.colorScheme.onSurface,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (description != null && description!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        description!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.caption.copyWith(
                          color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: AppSizes.sm),
              _RoleBadge(label: roleLabel, isOwner: isOwner),
              if (onEdit != null || onDelete != null)
                PopupMenuButton<String>(
                  icon: Icon(Icons.more_vert_rounded, color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
                  color: theme.colorScheme.surface,
                  onSelected: (value) {
                    if (value == 'edit') onEdit?.call();
                    if (value == 'delete') onDelete?.call();
                  },
                  itemBuilder: (ctx) => [
                    if (onEdit != null)
                      PopupMenuItem(value: 'edit', child: Text(AppLocalizations.of(ctx).get('edit'))),
                    if (onDelete != null)
                      PopupMenuItem(value: 'delete', child: Text(AppLocalizations.of(ctx).get('delete_team'))),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
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
        style: GoogleFonts.poppins(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
