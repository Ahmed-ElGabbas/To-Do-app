import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/features/collaboration/state/admin_provider.dart';

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key});

  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  int _tab = 0;
  final TextEditingController _userSearch = TextEditingController();
  final TextEditingController _teamSearch = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final provider = context.read<AdminProvider>();
      provider.loadStats();
      provider.loadUsers();
      provider.loadTeams();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _userSearch.dispose();
    _teamSearch.dispose();
    super.dispose();
  }

  void _searchUsers(String query) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      if (mounted) context.read<AdminProvider>().loadUsers(q: query.trim(), reset: true);
    });
  }

  void _searchTeams(String query) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      if (mounted) context.read<AdminProvider>().loadTeams(q: query.trim(), reset: true);
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
          l10n.get('admin_panel'),
          style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface),
        ),
        centerTitle: true,
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSizes.md),
            child: SegmentedButton<int>(
              segments: [
                ButtonSegment(value: 0, label: Text(l10n.get('analytics'))),
                ButtonSegment(value: 1, label: Text(l10n.get('users'))),
                ButtonSegment(value: 2, label: Text(l10n.get('teams'))),
              ],
              selected: {_tab},
              onSelectionChanged: (selection) => setState(() => _tab = selection.first),
            ),
          ),
          Expanded(
            child: switch (_tab) {
              0 => _StatsTab(),
              1 => _UsersTab(searchController: _userSearch, onSearch: _searchUsers),
              _ => _TeamsTab(searchController: _teamSearch, onSearch: _searchTeams),
            },
          ),
        ],
      ),
    );
  }
}

class _StatsTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    return Consumer<AdminProvider>(
      builder: (context, provider, child) {
        final stats = provider.stats;
        if (stats == null) {
          return Center(
            child: provider.isLoading
                ? const CircularProgressIndicator()
                : Text(
                    provider.errorMessage ?? '',
                    style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
                  ),
          );
        }
        return GridView.count(
          padding: const EdgeInsets.all(AppSizes.md),
          crossAxisCount: 2,
          crossAxisSpacing: AppSizes.sm,
          mainAxisSpacing: AppSizes.sm,
          childAspectRatio: 1.6,
          children: [
            _StatCard(value: stats.totalUsers, label: l10n.get('users'), icon: Icons.people_rounded),
            _StatCard(value: stats.totalTeams, label: l10n.get('teams'), icon: Icons.groups_rounded),
            _StatCard(value: stats.totalTasks, label: l10n.get('total_tasks'), icon: Icons.assignment_rounded),
            _StatCard(value: stats.completedTasks, label: l10n.get('completed_tasks'), icon: Icons.task_alt_rounded),
          ],
        );
      },
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.value, required this.label, required this.icon});

  final int value;
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSizes.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppSizes.radiusLg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: theme.primaryColor, size: 22),
          const SizedBox(height: AppSizes.sm),
          Text('$value', style: AppTextStyles.heading2.copyWith(color: theme.colorScheme.onSurface)),
          Text(label, style: AppTextStyles.caption.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5))),
        ],
      ),
    );
  }
}

class _UsersTab extends StatelessWidget {
  const _UsersTab({required this.searchController, required this.onSearch});

  final TextEditingController searchController;
  final void Function(String) onSearch;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSizes.md),
          child: TextField(
            controller: searchController,
            onChanged: onSearch,
            decoration: InputDecoration(
              hintText: l10n.get('search_users'),
              prefixIcon: const Icon(Icons.search_rounded),
              filled: true,
              fillColor: theme.colorScheme.surface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppSizes.radiusFull),
                borderSide: BorderSide.none,
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSizes.sm),
        Expanded(
          child: Consumer<AdminProvider>(
            builder: (context, provider, child) {
              if (provider.isLoading && provider.users.isEmpty) {
                return const Center(child: CircularProgressIndicator());
              }
              if (provider.users.isEmpty) {
                return Center(
                  child: Text(
                    l10n.get('no_users'),
                    style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
                  ),
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.all(AppSizes.md),
                itemCount: provider.users.length,
                separatorBuilder: (_, _) => const SizedBox(height: AppSizes.sm),
                itemBuilder: (context, index) {
                  final user = provider.users[index];
                  final isAdmin = user.role == 'ADMIN';
                  return Container(
                    padding: const EdgeInsets.all(AppSizes.md),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.surface,
                      borderRadius: BorderRadius.circular(AppSizes.radiusMd),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 20,
                          backgroundColor: theme.primaryColor.withValues(alpha: 0.1),
                          child: Text(
                            user.displayName.isNotEmpty ? user.displayName[0].toUpperCase() : '?',
                            style: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w700, color: theme.primaryColor),
                          ),
                        ),
                        const SizedBox(width: AppSizes.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                user.displayName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface, fontWeight: FontWeight.w600),
                              ),
                              Text(
                                user.email,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTextStyles.caption.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: AppSizes.sm, vertical: 4),
                          decoration: BoxDecoration(
                            color: (isAdmin ? theme.primaryColor : theme.colorScheme.secondary).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(AppSizes.radiusFull),
                          ),
                          child: Text(
                            isAdmin ? l10n.get('admin') : l10n.get('user_role'),
                            style: GoogleFonts.poppins(fontSize: 11, fontWeight: FontWeight.w600, color: isAdmin ? theme.primaryColor : theme.colorScheme.secondary),
                          ),
                        ),
                        PopupMenuButton<String>(
                          icon: Icon(Icons.more_vert_rounded, color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
                          color: theme.colorScheme.surface,
                          onSelected: (value) {
                            context
                                .read<AdminProvider>()
                                .updateUserRole(id: user.id, role: value);
                          },
                          itemBuilder: (ctx) => [
                            if (!isAdmin)
                              PopupMenuItem(value: 'ADMIN', child: Text(l10n.get('set_admin'))),
                            if (isAdmin)
                              PopupMenuItem(value: 'USER', child: Text(l10n.get('set_user'))),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}

class _TeamsTab extends StatelessWidget {
  const _TeamsTab({required this.searchController, required this.onSearch});

  final TextEditingController searchController;
  final void Function(String) onSearch;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSizes.md),
          child: TextField(
            controller: searchController,
            onChanged: onSearch,
            decoration: InputDecoration(
              hintText: l10n.get('search_placeholder'),
              prefixIcon: const Icon(Icons.search_rounded),
              filled: true,
              fillColor: theme.colorScheme.surface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppSizes.radiusFull),
                borderSide: BorderSide.none,
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSizes.sm),
        Expanded(
          child: Consumer<AdminProvider>(
            builder: (context, provider, child) {
              if (provider.isLoading && provider.teams.isEmpty) {
                return const Center(child: CircularProgressIndicator());
              }
              if (provider.teams.isEmpty) {
                return Center(
                  child: Text(
                    l10n.get('no_teams'),
                    style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
                  ),
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.all(AppSizes.md),
                itemCount: provider.teams.length,
                separatorBuilder: (_, _) => const SizedBox(height: AppSizes.sm),
                itemBuilder: (context, index) {
                  final team = provider.teams[index];
                  return Container(
                    padding: const EdgeInsets.all(AppSizes.md),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.surface,
                      borderRadius: BorderRadius.circular(AppSizes.radiusMd),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
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
                                team.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface, fontWeight: FontWeight.w600),
                              ),
                              Text(
                                '${team.memberCount} ${l10n.get('members')}',
                                style: AppTextStyles.caption.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
                              ),
                            ],
                          ),
                        ),
                        Icon(Icons.chevron_right_rounded, color: theme.colorScheme.onSurface.withValues(alpha: 0.4)),
                      ],
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}
