import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import 'package:antigravity/core/constants/colors.dart';
import 'package:antigravity/core/constants/strings.dart';
import 'package:antigravity/core/constants/sizes.dart';
import 'package:antigravity/core/theme/text_styles.dart';
import 'package:antigravity/core/utils/validators.dart';
import 'package:antigravity/core/utils/helpers.dart';
import 'package:antigravity/features/todo/domain/entities/task.dart';
import 'package:antigravity/features/todo/presentation/state/task_provider.dart';
import 'package:antigravity/features/todo/presentation/widgets/input_field.dart';
import 'package:antigravity/features/todo/presentation/widgets/priority_chip.dart';

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

  bool get isEditing => widget.existingTask != null;

  @override
  void initState() {
    super.initState();
    if (isEditing) {
      final task = widget.existingTask!;
      _titleController.text = task.title;
      _notesController.text = task.notes ?? '';
      _selectedPriority = task.priority;
      _selectedDate = task.date;
      final timeParts = Helpers.parseTimeString(task.time);
      _selectedHour = timeParts['hour'] as int;
      _selectedMinute = timeParts['minute'] as int;
      _selectedPeriod = timeParts['period'] as String;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          isEditing ? AppStrings.editTask : AppStrings.addTask,
          style: AppTextStyles.heading3,
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
                label: AppStrings.taskName,
                hintText: AppStrings.taskNameHint,
                controller: _titleController,
                validator: Validators.validateTaskName,
              ),
              const SizedBox(height: AppSizes.lg),
              Text('Date', style: AppTextStyles.labelLarge),
              const SizedBox(height: AppSizes.sm),
              Row(children: [
                _buildDateChip(AppStrings.dateToday, AppStrings.today),
                const SizedBox(width: AppSizes.sm),
                _buildDateChip(AppStrings.dateTomorrow, AppStrings.tomorrow),
              ]),
              const SizedBox(height: AppSizes.lg),
              Text(AppStrings.selectTime, style: AppTextStyles.labelLarge),
              const SizedBox(height: AppSizes.sm),
              _buildTimePicker(),
              const SizedBox(height: AppSizes.lg),
              Text(AppStrings.selectPriority, style: AppTextStyles.labelLarge),
              const SizedBox(height: AppSizes.sm),
              Row(children: [
                PriorityChip(label: AppStrings.high, isSelected: _selectedPriority == 'high', onTap: () => setState(() => _selectedPriority = 'high')),
                const SizedBox(width: AppSizes.sm),
                PriorityChip(label: AppStrings.medium, isSelected: _selectedPriority == 'medium', onTap: () => setState(() => _selectedPriority = 'medium')),
                const SizedBox(width: AppSizes.sm),
                PriorityChip(label: AppStrings.low, isSelected: _selectedPriority == 'low', onTap: () => setState(() => _selectedPriority = 'low')),
              ]),
              const SizedBox(height: AppSizes.lg),
              InputField(label: AppStrings.notes, hintText: AppStrings.notesHint, controller: _notesController, maxLines: 4, validator: Validators.validateNotes),
              const SizedBox(height: AppSizes.lg),
              InputField(label: AppStrings.attachments, hintText: AppStrings.attachmentsHint, controller: _attachmentsController, maxLines: 2),
              const SizedBox(height: AppSizes.xxl),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _saveTask,
        backgroundColor: AppColors.primary,
        child: Icon(isEditing ? Icons.check_rounded : Icons.add, color: AppColors.white),
      ),
    );
  }

  Widget _buildDateChip(String value, String label) {
    final isSelected = _selectedDate == value;
    return GestureDetector(
      onTap: () => setState(() => _selectedDate = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: AppSizes.md, vertical: AppSizes.sm),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.surface,
          borderRadius: BorderRadius.circular(AppSizes.radiusFull),
          border: Border.all(color: isSelected ? AppColors.primary : AppColors.border),
        ),
        child: Text(label, style: AppTextStyles.labelMedium.copyWith(color: isSelected ? AppColors.white : AppColors.textSecondary, fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400)),
      ),
    );
  }

  Widget _buildTimePicker() {
    return Container(
      height: AppSizes.timePickerHeight,
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(AppSizes.radiusMd), border: Border.all(color: AppColors.border)),
      child: Row(children: [
        Expanded(child: ListWheelScrollView.useDelegate(controller: _hourController, itemExtent: AppSizes.timePickerItemExtent, physics: const FixedExtentScrollPhysics(), onSelectedItemChanged: (i) => setState(() => _selectedHour = i + 1), childDelegate: ListWheelChildBuilderDelegate(builder: (ctx, i) { if (i < 0 || i >= 12) return null; final h = i + 1; final sel = h == _selectedHour; return Center(child: Text(h.toString().padLeft(2, '0'), style: AppTextStyles.heading3.copyWith(color: sel ? AppColors.primary : AppColors.textSecondary, fontWeight: sel ? FontWeight.w700 : FontWeight.w400))); }, childCount: 12))),
        Text(':', style: AppTextStyles.heading2.copyWith(color: AppColors.primary)),
        Expanded(child: ListWheelScrollView.useDelegate(controller: _minuteController, itemExtent: AppSizes.timePickerItemExtent, physics: const FixedExtentScrollPhysics(), onSelectedItemChanged: (i) => setState(() => _selectedMinute = i), childDelegate: ListWheelChildBuilderDelegate(builder: (ctx, i) { if (i < 0 || i >= 60) return null; final sel = i == _selectedMinute; return Center(child: Text(i.toString().padLeft(2, '0'), style: AppTextStyles.heading3.copyWith(color: sel ? AppColors.primary : AppColors.textSecondary, fontWeight: sel ? FontWeight.w700 : FontWeight.w400))); }, childCount: 60))),
        Expanded(child: ListWheelScrollView.useDelegate(controller: _periodController, itemExtent: AppSizes.timePickerItemExtent, physics: const FixedExtentScrollPhysics(), onSelectedItemChanged: (i) => setState(() => _selectedPeriod = i == 0 ? 'AM' : 'PM'), childDelegate: ListWheelChildBuilderDelegate(builder: (ctx, i) { if (i < 0 || i >= 2) return null; final p = i == 0 ? 'AM' : 'PM'; final sel = p == _selectedPeriod; return Center(child: Text(p, style: AppTextStyles.heading3.copyWith(color: sel ? AppColors.primary : AppColors.textSecondary, fontWeight: sel ? FontWeight.w700 : FontWeight.w400))); }, childCount: 2))),
      ]),
    );
  }

  void _saveTask() {
    if (_formKey.currentState?.validate() ?? false) {
      final timeString = Helpers.buildTimeString(_selectedHour, _selectedMinute, _selectedPeriod);
      final provider = Provider.of<TaskProvider>(context, listen: false);
      if (isEditing) {
        final updatedTask = widget.existingTask!.copyWith(title: _titleController.text.trim(), time: timeString, date: _selectedDate, priority: _selectedPriority, notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim());
        provider.updateTask(updatedTask);
      } else {
        final task = Task(id: const Uuid().v4(), title: _titleController.text.trim(), time: timeString, date: _selectedDate, priority: _selectedPriority, notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim());
        provider.addTask(task);
      }
      Navigator.of(context).pop();
    }
  }
}
