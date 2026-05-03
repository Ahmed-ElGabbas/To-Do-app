import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:antigravity/core/constants/colors.dart';
import 'package:antigravity/core/constants/sizes.dart';
import 'package:antigravity/core/constants/strings.dart';
import 'package:antigravity/core/theme/text_styles.dart';
import 'package:antigravity/features/todo/domain/entities/task.dart';
import 'package:antigravity/features/todo/presentation/state/task_provider.dart';
import 'package:antigravity/features/todo/presentation/state/task_state.dart';
import 'package:antigravity/features/todo/presentation/widgets/task_card.dart';
import 'package:antigravity/features/todo/presentation/screens/add_task_screen.dart';
import 'package:antigravity/features/todo/presentation/screens/task_details_screen.dart';
import 'package:antigravity/shared/widgets/loading_widget.dart';

class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key});

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';
  String _activeFilter = AppStrings.filterAll;

  final List<String> _filters = [
    AppStrings.filterAll,
    AppStrings.today,
    AppStrings.tomorrow,
    AppStrings.filterDone,
    AppStrings.filterPending,
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Task> _applyFilters(List<Task> tasks) {
    List<Task> filtered = List.from(tasks);
    if (_activeFilter == AppStrings.today) {
      filtered = filtered.where((t) => t.date.toLowerCase() == 'today').toList();
    } else if (_activeFilter == AppStrings.tomorrow) {
      filtered = filtered.where((t) => t.date.toLowerCase() == 'tomorrow').toList();
    } else if (_activeFilter == AppStrings.filterDone) {
      filtered = filtered.where((t) => t.isDone).toList();
    } else if (_activeFilter == AppStrings.filterPending) {
      filtered = filtered.where((t) => !t.isDone).toList();
    }
    if (_searchQuery.isNotEmpty) {
      filtered = filtered
          .where((t) => t.title.toLowerCase().contains(_searchQuery.toLowerCase()))
          .toList();
    }
    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        title: Text(AppStrings.allMyTasks, style: AppTextStyles.heading3),
        centerTitle: false,
        automaticallyImplyLeading: false,
      ),
      body: Consumer<TaskProvider>(
        builder: (context, provider, _) {
          if (provider.state == TaskState.loading) return const LoadingWidget();
          final filtered = _applyFilters(provider.tasks);
          return Column(
            children: [
              _buildSearchBar(),
              _buildFilterChips(),
              const SizedBox(height: AppSizes.sm),
              Expanded(
                child: filtered.isEmpty
                    ? _buildEmptyState()
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: AppSizes.md),
                        itemCount: filtered.length,
                        itemBuilder: (context, index) {
                          final task = filtered[index];
                          return Dismissible(
                            key: Key(task.id),
                            direction: DismissDirection.endToStart,
                            background: Container(
                              alignment: Alignment.centerRight,
                              padding: const EdgeInsets.only(right: AppSizes.lg),
                              margin: const EdgeInsets.only(bottom: AppSizes.sm),
                              decoration: BoxDecoration(
                                color: AppColors.error,
                                borderRadius: BorderRadius.circular(AppSizes.cardRadius),
                              ),
                              child: const Icon(Icons.delete_rounded, color: AppColors.white, size: AppSizes.iconLg),
                            ),
                            onDismissed: (_) => context.read<TaskProvider>().deleteTask(task.id),
                            child: TaskCard(
                              task: task,
                              onToggle: () => context.read<TaskProvider>().toggleDone(task.id),
                              onTap: () => Navigator.of(context).push(MaterialPageRoute(
                                builder: (_) => TaskDetailsScreen(task: task),
                              )),
                            ),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AddTaskScreen())),
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, color: AppColors.white),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      color: AppColors.background,
      padding: const EdgeInsets.fromLTRB(AppSizes.md, 0, AppSizes.md, AppSizes.md),
      child: TextField(
        controller: _searchController,
        onChanged: (val) => setState(() => _searchQuery = val),
        style: GoogleFonts.poppins(fontSize: 14, color: AppColors.textPrimary),
        decoration: InputDecoration(
          hintText: AppStrings.searchHint,
          hintStyle: GoogleFonts.poppins(color: AppColors.textSecondary, fontSize: 14),
          prefixIcon: const Icon(Icons.search_rounded, color: AppColors.primary),
          suffixIcon: _searchQuery.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary),
                  onPressed: () { _searchController.clear(); setState(() => _searchQuery = ''); },
                )
              : null,
          filled: true,
          fillColor: AppColors.surface,
          contentPadding: const EdgeInsets.symmetric(horizontal: AppSizes.md, vertical: AppSizes.sm),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: const BorderSide(color: AppColors.border)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: const BorderSide(color: AppColors.border)),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: const BorderSide(color: AppColors.primary, width: 2)),
        ),
      ),
    );
  }

  Widget _buildFilterChips() {
    return Container(
      color: AppColors.background,
      height: 50,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSizes.md, vertical: AppSizes.sm),
        itemCount: _filters.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSizes.sm),
        itemBuilder: (context, index) {
          final filter = _filters[index];
          final isActive = _activeFilter == filter;
          return GestureDetector(
            onTap: () => setState(() => _activeFilter = filter),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: AppSizes.md, vertical: AppSizes.xs),
              decoration: BoxDecoration(
                color: isActive ? AppColors.primary : AppColors.surface,
                borderRadius: BorderRadius.circular(AppSizes.radiusFull),
                border: Border.all(color: isActive ? AppColors.primary : AppColors.border),
              ),
              child: Text(
                filter,
                style: GoogleFonts.poppins(
                  fontSize: 12,
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                  color: isActive ? AppColors.white : AppColors.textSecondary,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.task_alt_rounded, size: 72, color: AppColors.primary.withValues(alpha: 0.25)),
          const SizedBox(height: AppSizes.md),
          Text(AppStrings.noTasksFound, style: AppTextStyles.heading3.copyWith(color: AppColors.textSecondary)),
          const SizedBox(height: AppSizes.sm),
          Text(AppStrings.addFirstTask, style: AppTextStyles.bodySmall),
        ],
      ),
    );
  }
}
