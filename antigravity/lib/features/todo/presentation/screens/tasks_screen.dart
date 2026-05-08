import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:tasko/core/constants/colors.dart';
import 'package:tasko/core/constants/strings.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/features/todo/presentation/state/task_provider.dart';
import 'package:tasko/features/todo/presentation/state/settings_provider.dart';
import 'package:tasko/features/todo/presentation/widgets/task_card.dart';
import 'package:tasko/features/todo/presentation/screens/add_task_screen.dart';
import 'package:tasko/features/todo/presentation/screens/task_details_screen.dart';
import 'package:tasko/features/todo/domain/entities/task.dart';

class TasksScreen extends StatefulWidget {
  final GlobalKey<ScaffoldState>? scaffoldKey;
  const TasksScreen({super.key, this.scaffoldKey});

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _activeFilter = 'all';
  String _searchQuery = '';

  final List<String> _filters = ['all', 'today', 'tomorrow', 'done', 'pending'];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Task> _applyFilter(List<Task> tasks) {
    List<Task> filtered = tasks;

    if (_searchQuery.isNotEmpty) {
      filtered = filtered
          .where((t) => t.title.toLowerCase().contains(_searchQuery.toLowerCase()))
          .toList();
    }

    switch (_activeFilter) {
      case 'today':
        filtered = filtered.where((t) => t.date.toLowerCase() == 'today').toList();
        break;
      case 'tomorrow':
        filtered = filtered.where((t) => t.date.toLowerCase() == 'tomorrow').toList();
        break;
      case 'done':
        filtered = filtered.where((t) => t.isDone).toList();
        break;
      case 'pending':
        filtered = filtered.where((t) => !t.isDone).toList();
        break;
    }

    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: theme.appBarTheme.backgroundColor,
        leading: IconButton(
          icon: Icon(Icons.menu_rounded, color: theme.colorScheme.onSurface),
          onPressed: () => widget.scaffoldKey?.currentState?.openDrawer(),
        ),
        title: Text(l10n.get('tasks'), style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface)),
        centerTitle: true,
      ),
      body: Consumer<TaskProvider>(
        builder: (context, provider, child) {
          final allTasks = provider.tasks;
          final filteredTasks = _applyFilter(allTasks);
          final completedCount = provider.completedCount;

          return Column(
            children: [
              Container(
                color: theme.colorScheme.surface,
                padding: const EdgeInsets.symmetric(horizontal: AppSizes.md, vertical: AppSizes.sm),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (allTasks.isNotEmpty) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: AppSizes.md, vertical: AppSizes.xs),
                        decoration: BoxDecoration(
                          color: theme.primaryColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(AppSizes.radiusFull),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.check_circle_rounded, color: theme.primaryColor, size: 16),
                            const SizedBox(width: AppSizes.xs),
                            Text(
                              '$completedCount ${l10n.get('completed')}',
                              style: GoogleFonts.poppins(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: theme.primaryColor,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSizes.sm),
                    ],

                    TextFormField(
                      controller: _searchController,
                      onChanged: (v) => setState(() => _searchQuery = v),
                      style: GoogleFonts.poppins(fontSize: 14, color: theme.colorScheme.onSurface),
                      decoration: InputDecoration(
                        hintText: l10n.get('search'),
                        hintStyle: GoogleFonts.poppins(color: theme.colorScheme.onSurface.withValues(alpha: 0.5), fontSize: 14),
                        filled: true,
                        fillColor: theme.brightness == Brightness.light ? Colors.white : theme.colorScheme.surface,
                        prefixIcon: Icon(Icons.search_rounded, color: theme.primaryColor),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? IconButton(
                                icon: Icon(Icons.close_rounded, color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() => _searchQuery = '');
                                },
                              )
                            : null,
                        contentPadding: const EdgeInsets.symmetric(horizontal: AppSizes.md, vertical: AppSizes.md),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: BorderSide(color: theme.dividerColor)),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: BorderSide(color: theme.dividerColor)),
                        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppSizes.radiusMd), borderSide: BorderSide(color: theme.primaryColor, width: 2)),
                      ),
                    ),
                    const SizedBox(height: AppSizes.sm),

                    SizedBox(
                      height: 40,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
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
                                color: isActive ? theme.primaryColor : Colors.transparent,
                                borderRadius: BorderRadius.circular(AppSizes.radiusFull),
                                border: Border.all(color: isActive ? theme.primaryColor : theme.dividerColor),
                              ),
                              child: Center(
                                child: Text(
                                  l10n.get(filter),
                                  style: GoogleFonts.poppins(
                                    fontSize: 13,
                                    fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                                    color: isActive ? Colors.white : theme.colorScheme.onSurface.withValues(alpha: 0.7),
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),

              Divider(color: theme.dividerColor, height: 1),

              Expanded(
                child: filteredTasks.isEmpty
                    ? _buildEmptyState(context, l10n)
                    : ListView.builder(
                        padding: const EdgeInsets.all(AppSizes.md),
                        itemCount: filteredTasks.length,
                        itemBuilder: (context, index) {
                          final task = filteredTasks[index];
                          return Dismissible(
                            key: ValueKey(task.id),
                            direction: DismissDirection.endToStart,
                            onDismissed: (_) => provider.deleteTask(task.id),
                            background: Container(
                              alignment: Alignment.centerRight,
                              padding: const EdgeInsets.only(right: AppSizes.lg),
                              color: Colors.redAccent,
                              child: const Icon(Icons.delete_outline_rounded, color: Colors.white),
                            ),
                            child: TaskCard(
                              task: task,
                              onToggle: () => provider.toggleDone(task.id),
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => TaskDetailsScreen(task: task)),
                              ),
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
        backgroundColor: theme.primaryColor,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context, AppLocalizations l10n) {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.task_alt_rounded, size: 72, color: theme.colorScheme.onSurface.withValues(alpha: 0.1)),
          const SizedBox(height: AppSizes.md),
          Text(l10n.get('no_tasks'), style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5))),
        ],
      ),
    );
  }
}
