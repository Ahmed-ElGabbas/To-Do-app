import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:antigravity/core/constants/colors.dart';
import 'package:antigravity/core/constants/strings.dart';
import 'package:antigravity/core/constants/sizes.dart';
import 'package:antigravity/core/theme/text_styles.dart';
import 'package:antigravity/core/utils/helpers.dart';
import 'package:antigravity/features/todo/domain/entities/task.dart';
import 'package:antigravity/features/todo/presentation/state/task_provider.dart';
import 'package:antigravity/features/todo/presentation/screens/add_task_screen.dart';
import 'package:antigravity/features/todo/presentation/widgets/custom_button.dart';

class TaskDetailsScreen extends StatelessWidget {
  final Task task;

  const TaskDetailsScreen({super.key, required this.task});

  Color _getPriorityColor(String priority) {
    switch (priority.toLowerCase()) {
      case 'high':
        return AppColors.highPriority;
      case 'medium':
        return AppColors.mediumPriority;
      case 'low':
        return AppColors.lowPriority;
      default:
        return AppColors.mediumPriority;
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<TaskProvider>(context);
    final currentTask = provider.tasks.firstWhere(
      (t) => t.id == task.id,
      orElse: () => task,
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(AppStrings.taskDetails, style: AppTextStyles.heading3),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_rounded, color: AppColors.primary),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => AddTaskScreen(existingTask: currentTask),
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline_rounded, color: AppColors.error),
            onPressed: () => _showDeleteDialog(context, currentTask.id),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSizes.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSizes.md, vertical: AppSizes.sm),
              decoration: BoxDecoration(
                color: currentTask.isDone ? AppColors.success.withValues(alpha: 0.1) : AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppSizes.radiusFull),
              ),
              child: Text(
                currentTask.isDone ? 'Completed' : 'In Progress',
                style: AppTextStyles.labelMedium.copyWith(color: currentTask.isDone ? AppColors.success : AppColors.primary),
              ),
            ),
            const SizedBox(height: AppSizes.lg),

            // Title
            Text(
              currentTask.title,
              style: currentTask.isDone ? AppTextStyles.heading2.copyWith(decoration: TextDecoration.lineThrough, color: AppColors.done) : AppTextStyles.heading2,
            ),
            const SizedBox(height: AppSizes.lg),

            // Info cards
            _buildInfoRow(Icons.access_time_rounded, 'Time', currentTask.time),
            const SizedBox(height: AppSizes.md),
            _buildInfoRow(Icons.calendar_today_rounded, 'Date', Helpers.capitalize(currentTask.date)),
            const SizedBox(height: AppSizes.md),
            _buildPriorityRow(currentTask.priority),
            const SizedBox(height: AppSizes.lg),

            // Notes
            if (currentTask.notes != null && currentTask.notes!.isNotEmpty) ...[
              Text(AppStrings.notes, style: AppTextStyles.labelLarge),
              const SizedBox(height: AppSizes.sm),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSizes.md),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppSizes.radiusMd),
                  border: Border.all(color: AppColors.border),
                ),
                child: Text(currentTask.notes!, style: AppTextStyles.bodyMedium),
              ),
              const SizedBox(height: AppSizes.lg),
            ],

            // Toggle button
            const SizedBox(height: AppSizes.md),
            CustomButton(
              text: currentTask.isDone ? AppStrings.markAsUndone : AppStrings.markAsDone,
              icon: currentTask.isDone ? Icons.undo_rounded : Icons.check_rounded,
              onPressed: () {
                provider.toggleDone(currentTask.id);
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Container(
      padding: const EdgeInsets.all(AppSizes.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSizes.radiusMd),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(AppSizes.radiusSm)),
          child: Icon(icon, color: AppColors.primary, size: 20),
        ),
        const SizedBox(width: AppSizes.md),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: AppTextStyles.caption),
          Text(value, style: AppTextStyles.bodyLarge),
        ]),
      ]),
    );
  }

  Widget _buildPriorityRow(String priority) {
    final color = _getPriorityColor(priority);
    return Container(
      padding: const EdgeInsets.all(AppSizes.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSizes.radiusMd),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(AppSizes.radiusSm)),
          child: Icon(Icons.flag_rounded, color: color, size: 20),
        ),
        const SizedBox(width: AppSizes.md),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Priority', style: AppTextStyles.caption),
          Text(Helpers.capitalize(priority), style: AppTextStyles.bodyLarge.copyWith(color: color, fontWeight: FontWeight.w600)),
        ]),
      ]),
    );
  }

  void _showDeleteDialog(BuildContext context, String taskId) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd)),
        title: Text(AppStrings.deleteConfirmTitle, style: AppTextStyles.heading3),
        content: Text(AppStrings.deleteConfirmMessage, style: AppTextStyles.bodyMedium),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: Text(AppStrings.cancel, style: AppTextStyles.labelLarge.copyWith(color: AppColors.textSecondary))),
          TextButton(
            onPressed: () {
              Provider.of<TaskProvider>(ctx, listen: false).deleteTask(taskId);
              Navigator.of(ctx).pop();
              Navigator.of(context).pop();
            },
            child: Text(AppStrings.confirm, style: AppTextStyles.labelLarge.copyWith(color: AppColors.error)),
          ),
        ],
      ),
    );
  }
}
