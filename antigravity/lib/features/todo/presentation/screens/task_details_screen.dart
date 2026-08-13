import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/features/todo/domain/entities/task.dart';
import 'package:tasko/features/todo/presentation/state/task_provider.dart';
import 'package:tasko/features/todo/presentation/screens/add_task_screen.dart';
import 'package:tasko/features/todo/presentation/widgets/custom_button.dart';
import 'package:tasko/shared/services/remote_config_service.dart';
import 'package:tasko/features/collaboration/presentation/screens/comments_screen.dart';

class TaskDetailsScreen extends StatelessWidget {
  final Task task;

  const TaskDetailsScreen({super.key, required this.task});

  Color _getPriorityColor(String priority, ThemeData theme) {
    switch (priority.toLowerCase()) {
      case 'high': return Colors.redAccent;
      case 'medium': return theme.primaryColor;
      case 'low': return Colors.blueAccent;
      default: return theme.primaryColor;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final provider = Provider.of<TaskProvider>(context);
    final currentTask = provider.tasks.firstWhere((t) => t.id == task.id, orElse: () => task);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: theme.appBarTheme.backgroundColor,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded, color: theme.colorScheme.onSurface),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(l10n.get('task_details'), style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface)),
        actions: [
          if (RemoteConfigService.collaborationFeaturesEnabled)
            IconButton(
              icon: Icon(Icons.chat_bubble_outline_rounded,
                  color: theme.primaryColor),
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => CommentsScreen(taskId: currentTask.id),
                  ),
                );
              },
            ),
          IconButton(
            icon: Icon(Icons.edit_rounded, color: theme.primaryColor),
            onPressed: () {
              Navigator.of(context).push(MaterialPageRoute(builder: (_) => AddTaskScreen(existingTask: currentTask)));
            },
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
            onPressed: () => _showDeleteDialog(context, currentTask.id),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSizes.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSizes.md, vertical: AppSizes.sm),
              decoration: BoxDecoration(
                color: currentTask.isDone ? Colors.green.withValues(alpha: 0.1) : theme.primaryColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppSizes.radiusFull),
              ),
              child: Text(
                currentTask.isDone ? l10n.get('done') : l10n.get('pending'),
                style: AppTextStyles.labelMedium.copyWith(color: currentTask.isDone ? Colors.green : theme.primaryColor),
              ),
            ),
            const SizedBox(height: AppSizes.lg),
            Text(
              currentTask.title,
              style: currentTask.isDone 
                  ? AppTextStyles.heading2.copyWith(decoration: TextDecoration.lineThrough, color: theme.colorScheme.onSurface.withValues(alpha: 0.3)) 
                  : AppTextStyles.heading2.copyWith(color: theme.colorScheme.onSurface),
            ),
            const SizedBox(height: AppSizes.lg),
            _buildInfoRow(context, Icons.access_time_rounded, l10n.get('time'), currentTask.time),
            const SizedBox(height: AppSizes.md),
            _buildInfoRow(context, Icons.calendar_today_rounded, l10n.get('today'), l10n.get(currentTask.date.toLowerCase()) != currentTask.date.toLowerCase() ? l10n.get(currentTask.date.toLowerCase()) : currentTask.date),
            const SizedBox(height: AppSizes.md),
            _buildPriorityRow(context, currentTask.priority, l10n),
            const SizedBox(height: AppSizes.lg),
            if (currentTask.notes != null && currentTask.notes!.isNotEmpty) ...[
              Text(l10n.get('notes'), style: AppTextStyles.labelLarge.copyWith(color: theme.colorScheme.onSurface)),
              const SizedBox(height: AppSizes.sm),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSizes.md),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surface,
                  borderRadius: BorderRadius.circular(AppSizes.radiusMd),
                  border: Border.all(color: theme.dividerColor),
                ),
                child: Text(currentTask.notes!, style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface)),
              ),
              const SizedBox(height: AppSizes.lg),
            ],
            const SizedBox(height: AppSizes.md),
            CustomButton(
              text: currentTask.isDone ? l10n.get('mark_as_undone') : l10n.get('done'),
              icon: currentTask.isDone ? Icons.undo_rounded : Icons.check_rounded,
              onPressed: () => provider.toggleDone(currentTask.id),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(BuildContext context, IconData icon, String label, String value) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSizes.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppSizes.radiusMd),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Row(children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(color: theme.primaryColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(AppSizes.radiusSm)),
          child: Icon(icon, color: theme.primaryColor, size: 20),
        ),
        const SizedBox(width: AppSizes.md),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: AppTextStyles.caption.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5))),
          Text(value, style: AppTextStyles.bodyLarge.copyWith(color: theme.colorScheme.onSurface)),
        ]),
      ]),
    );
  }

  Widget _buildPriorityRow(BuildContext context, String priority, AppLocalizations l10n) {
    final theme = Theme.of(context);
    final color = _getPriorityColor(priority, theme);
    return Container(
      padding: const EdgeInsets.all(AppSizes.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppSizes.radiusMd),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Row(children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(AppSizes.radiusSm)),
          child: Icon(Icons.flag_rounded, color: color, size: 20),
        ),
        const SizedBox(width: AppSizes.md),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(l10n.get('priority'), style: AppTextStyles.caption.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5))),
          Text(l10n.get(priority.toLowerCase()), style: AppTextStyles.bodyLarge.copyWith(color: color, fontWeight: FontWeight.w600)),
        ]),
      ]),
    );
  }

  void _showDeleteDialog(BuildContext context, String taskId) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: theme.colorScheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd)),
        title: Text(l10n.get('delete'), style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface)),
        content: Text(l10n.get('delete_all'), style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface)),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: Text(l10n.get('cancel'), style: AppTextStyles.labelLarge.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5)))),
          TextButton(
            onPressed: () {
              Provider.of<TaskProvider>(ctx, listen: false).deleteTask(taskId);
              Navigator.of(ctx).pop();
              Navigator.of(context).pop();
            },
            child: Text(l10n.get('confirm'), style: AppTextStyles.labelLarge.copyWith(color: Colors.redAccent, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
