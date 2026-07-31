import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:intl/intl.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/core/utils/helpers.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/features/todo/domain/entities/task.dart';
import 'package:tasko/features/todo/presentation/state/task_provider.dart';
import 'package:tasko/features/todo/presentation/state/settings_provider.dart';
import 'package:tasko/features/todo/presentation/widgets/task_card.dart';
import 'package:tasko/features/todo/presentation/screens/add_task_screen.dart';
import 'package:tasko/features/todo/presentation/screens/task_details_screen.dart';

class CalendarScreen extends StatefulWidget {
  final GlobalKey<ScaffoldState>? scaffoldKey;
  const CalendarScreen({super.key, this.scaffoldKey});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  DateTime _focusedDay = DateTime.now();
  DateTime _selectedDay = DateTime.now();

  DateTime? _taskToDate(Task task) {
    final d = task.date.toLowerCase();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    if (d == 'today') return today;
    if (d == 'tomorrow') return today.add(const Duration(days: 1));
    try {
      final parsed = DateTime.parse(d);
      return DateTime(parsed.year, parsed.month, parsed.day);
    } catch (_) {
      return null;
    }
  }

  List<Task> _tasksForDay(List<Task> all, DateTime day) {
    final target = DateTime(day.year, day.month, day.day);
    return all.where((t) {
      final d = _taskToDate(t);
      return d != null && d == target;
    }).toList();
  }

  bool _hasTasks(List<Task> all, DateTime day) => _tasksForDay(all, day).isNotEmpty;

  void _addTaskForDate(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final tomorrow = DateTime(now.year, now.month, now.day + 1);
    final sel = DateTime(_selectedDay.year, _selectedDay.month, _selectedDay.day);

    String dateArg;
    if (sel == today) {
      dateArg = 'today';
    } else if (sel == tomorrow) {
      dateArg = 'tomorrow';
    } else {
      dateArg = DateFormat('yyyy-MM-dd').format(_selectedDay);
    }

    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => AddTaskScreen(initialDate: dateArg)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final settings = context.watch<SettingsProvider>();

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: theme.appBarTheme.backgroundColor,
        leading: IconButton(
          icon: Icon(Icons.menu_rounded, color: theme.colorScheme.onSurface),
          onPressed: () => widget.scaffoldKey?.currentState?.openDrawer(),
        ),
        title: Text(l10n.get('calendar'), style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface)),
        centerTitle: true,
      ),
      body: Consumer<TaskProvider>(
        builder: (context, provider, _) {
          final allTasks = provider.tasks;
          final dayTasks = _tasksForDay(allTasks, _selectedDay);

          return Column(
            children: [
              Container(
                color: theme.colorScheme.surface,
                child: TableCalendar<Task>(
                  locale: settings.language,
                  firstDay: DateTime.utc(2020, 1, 1),
                  lastDay: DateTime.utc(2030, 12, 31),
                  focusedDay: _focusedDay,
                  selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
                  eventLoader: (day) => _tasksForDay(allTasks, day),
                  calendarStyle: CalendarStyle(
                    selectedDecoration: BoxDecoration(color: theme.primaryColor, shape: BoxShape.circle),
                    todayDecoration: BoxDecoration(color: theme.primaryColor.withValues(alpha: 0.25), shape: BoxShape.circle),
                    todayTextStyle: AppTextStyles.bodyMedium.copyWith(color: theme.primaryColor, fontWeight: FontWeight.w700),
                    selectedTextStyle: AppTextStyles.bodyMedium.copyWith(color: Colors.white, fontWeight: FontWeight.w700),
                    markerDecoration: BoxDecoration(color: theme.primaryColor, shape: BoxShape.circle),
                    markerSize: 5,
                    markersMaxCount: 1,
                    outsideDaysVisible: false,
                    defaultTextStyle: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface),
                    weekendTextStyle: AppTextStyles.bodyMedium.copyWith(color: Colors.redAccent),
                  ),
                  headerStyle: HeaderStyle(
                    formatButtonVisible: false,
                    titleCentered: true,
                    titleTextStyle: AppTextStyles.labelLarge.copyWith(fontSize: 16, color: theme.colorScheme.onSurface),
                    leftChevronIcon: Icon(Icons.chevron_left_rounded, color: theme.primaryColor),
                    rightChevronIcon: Icon(Icons.chevron_right_rounded, color: theme.primaryColor),
                  ),
                  daysOfWeekStyle: DaysOfWeekStyle(
                    weekdayStyle: AppTextStyles.caption.copyWith(fontWeight: FontWeight.w600, color: theme.colorScheme.onSurface.withValues(alpha: 0.5)),
                    weekendStyle: AppTextStyles.caption.copyWith(color: Colors.redAccent, fontWeight: FontWeight.w600),
                  ),
                  calendarBuilders: CalendarBuilders(
                    markerBuilder: (context, day, events) {
                      if (!_hasTasks(allTasks, day)) return const SizedBox.shrink();
                      return Positioned(
                        bottom: 4,
                        child: Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(color: theme.primaryColor, shape: BoxShape.circle),
                        ),
                      );
                    },
                  ),
                  onDaySelected: (selected, focused) {
                    setState(() {
                      _selectedDay = selected;
                      _focusedDay = focused;
                    });
                  },
                  onPageChanged: (focused) {
                    setState(() => _focusedDay = focused);
                  },
                ),
              ),

              Divider(height: 1, color: theme.dividerColor),

              Padding(
                padding: const EdgeInsets.fromLTRB(AppSizes.md, AppSizes.md, AppSizes.md, AppSizes.sm),
                child: Row(
                  children: [
                    Icon(Icons.calendar_today_rounded, color: theme.primaryColor, size: 18),
                    const SizedBox(width: AppSizes.sm),
                    Text(
                      Helpers.formatDate(_selectedDay),
                      style: AppTextStyles.labelLarge.copyWith(color: theme.primaryColor),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: AppSizes.sm, vertical: AppSizes.xs),
                      decoration: BoxDecoration(
                        color: theme.primaryColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(AppSizes.radiusFull),
                      ),
                      child: Text(
                        '${dayTasks.length} ${l10n.get('tasks')}',
                        style: AppTextStyles.caption.copyWith(color: theme.primaryColor, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),

              Expanded(
                child: dayTasks.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.event_available_rounded, size: 56, color: theme.colorScheme.onSurface.withValues(alpha: 0.1)),
                            const SizedBox(height: AppSizes.md),
                            Text(l10n.get('no_tasks_for_day'), style: AppTextStyles.bodyMedium.copyWith(color: theme.colorScheme.onSurface.withValues(alpha: 0.5))),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: AppSizes.md),
                        itemCount: dayTasks.length,
                        itemBuilder: (context, index) {
                          final task = dayTasks[index];
                          return TaskCard(
                            task: task,
                            onToggle: () => context.read<TaskProvider>().toggleDone(task.id),
                            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => TaskDetailsScreen(task: task))),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _addTaskForDate(context),
        backgroundColor: theme.primaryColor,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }
}
