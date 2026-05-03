import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:antigravity/core/constants/colors.dart';
import 'package:antigravity/core/constants/strings.dart';
import 'package:antigravity/core/constants/sizes.dart';
import 'package:antigravity/core/theme/text_styles.dart';
import 'package:antigravity/core/utils/helpers.dart';
import 'package:antigravity/features/auth/state/auth_provider.dart';
import 'package:antigravity/features/todo/presentation/state/task_provider.dart';
import 'package:antigravity/features/todo/presentation/state/task_state.dart';
import 'package:antigravity/features/todo/presentation/widgets/task_card.dart';
import 'package:antigravity/features/todo/presentation/screens/add_task_screen.dart';
import 'package:antigravity/features/todo/presentation/screens/task_details_screen.dart';
import 'package:antigravity/shared/widgets/loading_widget.dart';
import 'package:antigravity/features/todo/domain/entities/task.dart';

class HomeScreen extends StatelessWidget {
  final GlobalKey<ScaffoldState>? scaffoldKey;
  const HomeScreen({super.key, this.scaffoldKey});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        leading: IconButton(
          icon: const Icon(Icons.menu_rounded, color: AppColors.textPrimary),
          onPressed: () => scaffoldKey?.currentState?.openDrawer(),
        ),
        title: Text(AppStrings.appName, style: AppTextStyles.heading3),
        centerTitle: true,
        actions: [
          Container(
            margin: const EdgeInsets.only(right: AppSizes.md),
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppSizes.radiusMd),
            ),
            child: const Icon(Icons.notifications_outlined, color: AppColors.primary),
          ),
        ],
      ),
      body: _buildTasksView(context, auth),
      floatingActionButton: FloatingActionButton(
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const AddTaskScreen()),
        ),
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, color: AppColors.white),
      ),
    );
  }

  Widget _buildTasksView(BuildContext context, AuthProvider auth) {
    return Consumer<TaskProvider>(
      builder: (context, provider, child) {
        if (provider.state == TaskState.loading) return const LoadingWidget();

        final todayTasks = provider.todayTasks;
        final tomorrowTasks = provider.tomorrowTasks;
        final doneTasks = provider.tasks.where((t) => t.isDone).length;
        final total = provider.tasks.length;

        return SingleChildScrollView(
          padding: const EdgeInsets.all(AppSizes.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Greeting card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSizes.lg),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primary, AppColors.primaryDark],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(AppSizes.radiusLg),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${Helpers.getGreeting()}, ${auth.name.isNotEmpty ? auth.name.split(' ').first : 'there'} 👋',
                      style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.white),
                    ),
                    const SizedBox(height: AppSizes.xs),
                    Text(
                      Helpers.formatDate(DateTime.now()),
                      style: GoogleFonts.poppins(fontSize: 13, color: AppColors.white.withValues(alpha: 0.8)),
                    ),
                    const SizedBox(height: AppSizes.md),
                    Text(
                      '$doneTasks / $total tasks completed',
                      style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.white.withValues(alpha: 0.9)),
                    ),
                    const SizedBox(height: AppSizes.sm),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(AppSizes.radiusFull),
                      child: LinearProgressIndicator(
                        value: total > 0 ? doneTasks / total : 0,
                        backgroundColor: AppColors.white.withValues(alpha: 0.3),
                        valueColor: const AlwaysStoppedAnimation<Color>(AppColors.white),
                        minHeight: 6,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: AppSizes.lg),

              // TODAY Section
              _buildSectionHeader(
                context: context,
                title: AppStrings.today,
                taskCount: todayTasks.length,
                onAdd: () => _navigateToAddTask(context, AppStrings.dateToday),
              ),
              const SizedBox(height: AppSizes.sm),
              if (todayTasks.isEmpty)
                _buildEmptyState(AppStrings.noTasksToday)
              else
                ...todayTasks.map((task) => TaskCard(
                      task: task,
                      onToggle: () => provider.toggleDone(task.id),
                      onTap: () => _navigateToDetails(context, task),
                    )),

              const SizedBox(height: AppSizes.lg),

              // TOMORROW Section
              _buildSectionHeader(
                context: context,
                title: AppStrings.tomorrow,
                taskCount: tomorrowTasks.length,
                onAdd: () => _navigateToAddTask(context, AppStrings.dateTomorrow),
              ),
              const SizedBox(height: AppSizes.sm),
              if (tomorrowTasks.isEmpty)
                _buildEmptyState(AppStrings.noTasksTomorrow)
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
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Text(title, style: AppTextStyles.sectionTitle),
            const SizedBox(width: AppSizes.sm),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSizes.sm, vertical: AppSizes.xs),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppSizes.radiusFull),
              ),
              child: Text('$taskCount', style: AppTextStyles.caption.copyWith(color: AppColors.primary, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
        GestureDetector(
          onTap: onAdd,
          child: Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
            child: const Icon(Icons.add, color: AppColors.white, size: 20),
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState(String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: AppSizes.xl),
      child: Column(
        children: [
          Icon(Icons.task_alt_rounded, size: 48, color: AppColors.textSecondary.withValues(alpha: 0.3)),
          const SizedBox(height: AppSizes.sm),
          Text(message, style: AppTextStyles.bodySmall.copyWith(color: AppColors.textSecondary)),
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
