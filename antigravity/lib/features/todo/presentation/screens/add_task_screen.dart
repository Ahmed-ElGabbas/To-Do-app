import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import 'package:intl/intl.dart';
import 'package:tasko/core/constants/colors.dart';
import 'package:tasko/core/constants/strings.dart';
import 'package:tasko/core/constants/sizes.dart';
import 'package:tasko/core/theme/text_styles.dart';
import 'package:tasko/core/utils/validators.dart';
import 'package:tasko/core/utils/helpers.dart';
import 'package:tasko/core/localization/app_localizations.dart';
import 'package:tasko/features/todo/domain/entities/task.dart';
import 'package:tasko/features/todo/presentation/state/task_provider.dart';
import 'package:tasko/features/todo/presentation/widgets/input_field.dart';
import 'package:tasko/features/todo/presentation/widgets/priority_chip.dart';

class AddTaskScreen extends StatefulWidget {
  final String initialDate;
  final Task? existingTask;

  const AddTaskScreen({
    super.key,
    this.initialDate = 'today',
    this.existingTask,
  });

  @override
  State<AddTaskScreen> createState() => _AddTaskScreenState();
}

class _AddTaskScreenState extends State<AddTaskScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _notesController = TextEditingController();
  final _attachmentsController = TextEditingController();

  late String _selectedPriority;
  late String _selectedDate;
  late int _selectedHour;
  late int _selectedMinute;
  late String _selectedPeriod;

  late FixedExtentScrollController _hourController;
  late FixedExtentScrollController _minuteController;
  late FixedExtentScrollController _periodController;

  bool get _isEditing => widget.existingTask != null;

  bool get _isCustomDate {
    final d = widget.initialDate.toLowerCase();
    return d != 'today' && d != 'tomorrow';
  }

  @override
  void initState() {
    super.initState();
    if (_isEditing) {
      final t = widget.existingTask!;
      _titleController.text = t.title;
      _notesController.text = t.notes ?? '';
      _selectedPriority = t.priority;
      _selectedDate = t.date;
      final tp = Helpers.parseTimeString(t.time);
      _selectedHour = tp['hour'] as int;
      _selectedMinute = tp['minute'] as int;
      _selectedPeriod = tp['period'] as String;
    } else {
      _selectedPriority = 'medium';
      _selectedDate = widget.initialDate;
      _selectedHour = 6;
      _selectedMinute = 0;
      _selectedPeriod = 'AM';
    }
    _hourController = FixedExtentScrollController(initialItem: _selectedHour - 1);
    _minuteController = FixedExtentScrollController(initialItem: _selectedMinute);
    _periodController = FixedExtentScrollController(initialItem: _selectedPeriod == 'AM' ? 0 : 1);
  }

  @override
  void dispose() {
    _titleController.dispose();
    _notesController.dispose();
    _attachmentsController.dispose();
    _hourController.dispose();
    _minuteController.dispose();
    _periodController.dispose();
    super.dispose();
  }

  void _saveTask() {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final title = _titleController.text.trim();
    final notes = _notesController.text.trim();
    final time = Helpers.buildTimeString(_selectedHour, _selectedMinute, _selectedPeriod);
    final provider = context.read<TaskProvider>();

    if (_isEditing) {
      final updated = widget.existingTask!.copyWith(
        title: title,
        time: time,
        date: _selectedDate,
        priority: _selectedPriority,
        notes: notes.isEmpty ? null : notes,
      );
      provider.updateTask(updated);
    } else {
      final task = Task(
        id: const Uuid().v4(),
        title: title,
        time: time,
        date: _selectedDate,
        priority: _selectedPriority,
        notes: notes.isEmpty ? null : notes,
      );
      provider.addTask(task);
    }

    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: theme.appBarTheme.backgroundColor,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded, color: theme.colorScheme.onSurface),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          _isEditing ? l10n.get('save') : l10n.get('add_task'),
          style: AppTextStyles.heading3.copyWith(color: theme.colorScheme.onSurface),
        ),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSizes.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              InputField(
                label: l10n.get('task_name'),
                hintText: l10n.get('task_name'),
                controller: _titleController,
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return l10n.get('field_required');
                  return null;
                },
              ),
              const SizedBox(height: AppSizes.lg),

              Text(l10n.get('today').toUpperCase(), style: AppTextStyles.labelLarge.copyWith(color: theme.colorScheme.onSurface)),
              const SizedBox(height: AppSizes.sm),
              _buildDateRow(l10n),
              const SizedBox(height: AppSizes.lg),

              Text(l10n.get('time'), style: AppTextStyles.labelLarge.copyWith(color: theme.colorScheme.onSurface)),
              const SizedBox(height: AppSizes.sm),
              _buildTimePicker(theme),
              const SizedBox(height: AppSizes.lg),

              Text(l10n.get('priority'), style: AppTextStyles.labelLarge.copyWith(color: theme.colorScheme.onSurface)),
              const SizedBox(height: AppSizes.sm),
              Row(children: [
                PriorityChip(
                  label: l10n.get('high'),
                  isSelected: _selectedPriority == 'high',
                  onTap: () => setState(() => _selectedPriority = 'high'),
                ),
                const SizedBox(width: AppSizes.sm),
                PriorityChip(
                  label: l10n.get('medium'),
                  isSelected: _selectedPriority == 'medium',
                  onTap: () => setState(() => _selectedPriority = 'medium'),
                ),
                const SizedBox(width: AppSizes.sm),
                PriorityChip(
                  label: l10n.get('low'),
                  isSelected: _selectedPriority == 'low',
                  onTap: () => setState(() => _selectedPriority = 'low'),
                ),
              ]),
              const SizedBox(height: AppSizes.lg),

              InputField(
                label: l10n.get('notes'),
                hintText: l10n.get('notes'),
                controller: _notesController,
                maxLines: 4,
              ),
              const SizedBox(height: AppSizes.xxl + AppSizes.xxl),
            ],
          ),
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: SizedBox(
        width: 72,
        height: 72,
        child: FloatingActionButton(
          onPressed: _saveTask,
          backgroundColor: theme.primaryColor,
          shape: const CircleBorder(),
          elevation: 6,
          child: const Icon(Icons.check_rounded, color: Colors.white, size: 36),
        ),
      ),
    );
  }

  Widget _buildDateRow(AppLocalizations l10n) {
    if (_isCustomDate) {
      String label;
      try {
        label = DateFormat('MMM dd, yyyy').format(DateTime.parse(_selectedDate));
      } catch (_) {
        label = _selectedDate;
      }
      return Wrap(
        spacing: AppSizes.sm,
        runSpacing: AppSizes.sm,
        children: [
          _dateChip('today', l10n.get('today')),
          _dateChip('tomorrow', l10n.get('tomorrow')),
          _dateChip(widget.initialDate, label),
        ],
      );
    }
    return Row(children: [
      _dateChip('today', l10n.get('today')),
      const SizedBox(width: AppSizes.sm),
      _dateChip('tomorrow', l10n.get('tomorrow')),
    ]);
  }

  Widget _dateChip(String value, String label) {
    final isSelected = _selectedDate == value;
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: () => setState(() => _selectedDate = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: AppSizes.md, vertical: AppSizes.sm),
        decoration: BoxDecoration(
          color: isSelected ? theme.primaryColor : theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(AppSizes.radiusFull),
          border: Border.all(color: isSelected ? theme.primaryColor : theme.dividerColor),
        ),
        child: Text(
          label,
          style: AppTextStyles.labelMedium.copyWith(
            color: isSelected ? Colors.white : theme.colorScheme.onSurface.withValues(alpha: 0.7),
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ),
    );
  }

  Widget _buildTimePicker(ThemeData theme) {
    return Container(
      height: AppSizes.timePickerHeight,
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppSizes.radiusMd),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Row(children: [
        _scrollColumn(
          count: 12,
          builder: (i) {
            final h = i + 1;
            final sel = h == _selectedHour;
            return _pickerItem(theme, h.toString().padLeft(2, '0'), sel);
          },
          controller: _hourController,
          onChanged: (i) => setState(() => _selectedHour = i + 1),
        ),
        Text(':', style: AppTextStyles.heading2.copyWith(color: theme.primaryColor)),
        _scrollColumn(
          count: 60,
          builder: (i) {
            final sel = i == _selectedMinute;
            return _pickerItem(theme, i.toString().padLeft(2, '0'), sel);
          },
          controller: _minuteController,
          onChanged: (i) => setState(() => _selectedMinute = i),
        ),
        _scrollColumn(
          count: 2,
          builder: (i) {
            final p = i == 0 ? 'AM' : 'PM';
            final sel = p == _selectedPeriod;
            return _pickerItem(theme, p, sel);
          },
          controller: _periodController,
          onChanged: (i) => setState(() => _selectedPeriod = i == 0 ? 'AM' : 'PM'),
        ),
      ]),
    );
  }

  Widget _scrollColumn({
    required int count,
    required Widget Function(int) builder,
    required FixedExtentScrollController controller,
    required void Function(int) onChanged,
  }) {
    return Expanded(
      child: ListWheelScrollView.useDelegate(
        controller: controller,
        itemExtent: AppSizes.timePickerItemExtent,
        physics: const FixedExtentScrollPhysics(),
        onSelectedItemChanged: onChanged,
        childDelegate: ListWheelChildBuilderDelegate(
          builder: (ctx, i) {
            if (i < 0 || i >= count) return null;
            return builder(i);
          },
          childCount: count,
        ),
      ),
    );
  }

  Widget _pickerItem(ThemeData theme, String text, bool selected) {
    return Center(
      child: Text(
        text,
        style: AppTextStyles.heading3.copyWith(
          color: selected ? theme.primaryColor : theme.colorScheme.onSurface.withValues(alpha: 0.3),
          fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
        ),
      ),
    );
  }
}
