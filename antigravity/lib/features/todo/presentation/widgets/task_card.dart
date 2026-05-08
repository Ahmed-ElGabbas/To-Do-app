import 'package:flutter/material.dart';
import 'package:tasko/core/constants/colors.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/features/todo/domain/entities/task.dart';

class TaskCard extends StatelessWidget {
  final Task task;
  final VoidCallback onToggle;
  final VoidCallback onTap;

  const TaskCard({
    super.key,
    required this.task,
    required this.onToggle,
    required this.onTap,
  });

  Color _getPriorityColor(ThemeData theme) {
    switch (task.priority.toLowerCase()) {
      case 'high': return Colors.redAccent;
      case 'low': return Colors.blueAccent;
      case 'medium':
      default: return theme.primaryColor;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return InkWell(
      onTap: onTap,
      child: Container(
        color: theme.colorScheme.surface,
        padding: const EdgeInsets.symmetric(horizontal: AppSizes.md, vertical: AppSizes.md),
        child: Row(
          children: [
            GestureDetector(
              onTap: onToggle,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: AppSizes.checkboxSize,
                height: AppSizes.checkboxSize,
                decoration: BoxDecoration(
                  color: task.isDone ? theme.primaryColor : Colors.transparent,
                  borderRadius: BorderRadius.circular(4), // More square as per PROJECT_STRUCTURE.md
                  border: Border.all(color: theme.primaryColor, width: 2),
                ),
                child: task.isDone ? const Icon(Icons.check, size: 16, color: Colors.white) : null,
              ),
            ),
            const SizedBox(width: AppSizes.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    task.title,
                    style: AppTextStyles.taskTitle.copyWith(
                      color: task.isDone ? theme.colorScheme.onSurface.withValues(alpha: 0.3) : theme.colorScheme.onSurface,
                      decoration: task.isDone ? TextDecoration.lineThrough : null,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Icon(Icons.access_time_rounded, size: 13, color: task.isDone ? AppColors.textSecondary : theme.colorScheme.onSurface.withValues(alpha: 0.5)),
                      const SizedBox(width: 4),
                      Text(
                        task.time,
                        style: AppTextStyles.timeText.copyWith(color: task.isDone ? AppColors.textSecondary : theme.colorScheme.onSurface.withValues(alpha: 0.5)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Container(
              width: 4,
              height: 36,
              decoration: BoxDecoration(
                color: task.isDone ? theme.dividerColor : _getPriorityColor(theme),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
