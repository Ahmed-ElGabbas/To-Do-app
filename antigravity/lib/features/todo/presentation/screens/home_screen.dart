import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:tasko/core/constants/strings.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/core/utils/helpers.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/features/auth/state/auth_provider.dart';
import 'package:tasko/features/todo/presentation/state/task_provider.dart';
import 'package:tasko/features/todo/presentation/state/settings_provider.dart';
import 'package:tasko/features/todo/presentation/widgets/task_card.dart';
import 'package:tasko/features/todo/presentation/screens/add_task_screen.dart';
import 'package:tasko/features/todo/presentation/screens/task_details_screen.dart';
import 'package:tasko/features/todo/domain/entities/task.dart';

class HomeScreen extends StatelessWidget {
  final GlobalKey<ScaffoldState>? scaffoldKey;
  const HomeScreen({super.key, this.scaffoldKey});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: theme.appBarTheme.backgroundColor,
        leading: IconButton(
          icon: Icon(Icons.menu_rounded, color: theme.colorScheme.onSurface),
          onPressed: () => scaffoldKey?.currentState?.openDrawer(),
        ),
        title: Text(
          l10n.get('app_name'),
          style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface),
        ),
        centerTitle: true,
        actions: [
          Container(
            margin: const EdgeInsets.only(right: AppSizes.md),
            child: IconButton(
              icon: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: theme.primaryColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppSizes.radiusMd),
                ),
                child: Icon(
                  Icons.notifications_outlined,
                  color: theme.primaryColor,
                ),
              ),
              onPressed: () => _showNotificationsDialog(context),
            ),
          ),
        ],
      ),
      body: _buildTasksView(context, auth),
      floatingActionButton: FloatingActionButton(
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const AddTaskScreen()),
        ),
        backgroundColor: theme.primaryColor,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  void _showNotificationsDialog(BuildContext context) {
    final provider = context.read<TaskProvider>();
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final upcoming = provider.tasks.where((t) => !t.isDone).toList()
      ..sort((a, b) => a.time.compareTo(b.time));

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: theme.colorScheme.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSizes.radiusMd),
        ),
        title: Row(
          children: [
            Icon(Icons.notifications_rounded, color: theme.primaryColor),
            const SizedBox(width: AppSizes.sm),
            Text(l10n.get('upcoming'), style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface)),
          ],
        ),
        content: upcoming.isEmpty
            ? Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSizes.md),
                child: Text(
                  l10n.get('no_upcoming'),
                  style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface),
                  textAlign: TextAlign.center,
                ),
              )
            : SizedBox(
                width: double.maxFinite,
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: upcoming.length,
                  separatorBuilder: (_, _) => Divider(color: theme.dividerColor),
                  itemBuilder: (ctx, i) {
                    final t = upcoming[i];
                    return ListTile(
                      dense: true,
                      leading: Icon(Icons.access_time_rounded, color: theme.primaryColor, size: 18),
                      title: Text(t.title, style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface)),
                      trailing: Text(t.time, style: AppTextStyles.caption.copyWith(color: theme.primaryColor)),
                    );
                  },
                ),
              ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(l10n.get('cancel'), style: AppTextStyles.labelLarge.copyWith(color: theme.primaryColor)),
          ),
        ],
      ),
    );
  }

  Widget _buildTasksView(BuildContext context, AuthProvider auth) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Consumer<TaskProvider>(
      builder: (context, provider, child) {
        final todayTasks = provider.todayTasks;
        final tomorrowTasks = provider.tomorrowTasks;
        final doneTasks = provider.completedCount;
        final total = provider.tasks.length;
        final firstName = auth.name.isNotEmpty ? auth.name.split(' ').first : 'there';

        return SingleChildScrollView(
          padding: const EdgeInsets.all(AppSizes.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSizes.lg),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [theme.primaryColor, theme.colorScheme.secondary],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(AppSizes.radiusLg),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${l10n.get('hello')}, $firstName! 👋',
                      style: GoogleFonts.poppins(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: AppSizes.xs),
                    Text(
                      Helpers.formatDate(DateTime.now()),
                      style: GoogleFonts.poppins(
                        fontSize: 13,
                        color: Colors.white.withValues(alpha: 0.8),
                      ),
                    ),
                    const SizedBox(height: AppSizes.md),
                    Text(
                      '$doneTasks / $total ${l10n.get('completed')}',
                      style: GoogleFonts.poppins(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: Colors.white.withValues(alpha: 0.9),
                      ),
                    ),
                    const SizedBox(height: AppSizes.sm),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(AppSizes.radiusFull),
                      child: LinearProgressIndicator(
                        value: total > 0 ? doneTasks / total : 0,
                        backgroundColor: Colors.white.withValues(alpha: 0.3),
                        valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                        minHeight: 6,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: AppSizes.lg),

              _buildSectionHeader(
                context: context,
                title: l10n.get('today'),
                taskCount: todayTasks.length,
                onAdd: () => _navigateToAddTask(context, AppStrings.dateToday),
              ),
              const SizedBox(height: AppSizes.sm),
              if (todayTasks.isEmpty)
                _buildEmptyState(context, l10n.get('no_tasks_today'))
              else
                ...todayTasks.map((task) => TaskCard(
                      task: task,
                      onToggle: () => provider.toggleDone(task.id),
                      onTap: () => _navigateToDetails(context, task),
                    )),

              const SizedBox(height: AppSizes.lg),

              _buildSectionHeader(
                context: context,
                title: l10n.get('tomorrow'),
                taskCount: tomorrowTasks.length,
                onAdd: () => _navigateToAddTask(context, AppStrings.dateTomorrow),
              ),
              const SizedBox(height: AppSizes.sm),
              if (tomorrowTasks.isEmpty)
                _buildEmptyState(context, l10n.get('no_tasks_tomorrow'))
              else
                ...tomorrowTasks.map((task) => TaskCard(
                      task: task,
                      onToggle: () => provider.toggleDone(task.id),
                      onTap: () => _navigateToDetails(context, task),
                    )),

              const SizedBox(height: AppSizes.xxl),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSectionHeader({
    required BuildContext context,
    required String title,
    required int taskCount,
    required VoidCallback onAdd,
  }) {
    final theme = Theme.of(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Text(title, style: AppTextStyles.sectionTitle.copyWith(color: theme.colorScheme.onSurface)),
            const SizedBox(width: AppSizes.sm),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSizes.sm, vertical: AppSizes.xs),
              decoration: BoxDecoration(
                color: theme.primaryColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppSizes.radiusFull),
              ),
              child: Text(
                '$taskCount',
                style: AppTextStyles.caption.copyWith(color: theme.primaryColor, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
        GestureDetector(
          onTap: onAdd,
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: theme.primaryColor, shape: BoxShape.circle),
            child: const Icon(Icons.add, color: Colors.white, size: 20),
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState(BuildContext context, String message) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: AppSizes.xl),
      child: Column(
        children: [
          Icon(Icons.task_alt_rounded, size: 48, color: theme.colorScheme.onSurface.withValues(alpha: 0.2)),
          const SizedBox(height: AppSizes.sm),
          Text(message, style: AppTextStyles.bodySmall.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5))),
        ],
      ),
    );
  }

  void _navigateToAddTask(BuildContext context, String date) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => AddTaskScreen(initialDate: date)));
  }

  void _navigateToDetails(BuildContext context, Task task) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => TaskDetailsScreen(task: task)));
  }
}
