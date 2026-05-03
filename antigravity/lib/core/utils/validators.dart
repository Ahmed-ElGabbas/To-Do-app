import 'package:antigravity/core/constants/strings.dart';

class Validators {
  Validators._();

  /// Validates a task name
  /// Returns null if valid, or an error message string if invalid
  static String? validateTaskName(String? value) {
    if (value == null || value.trim().isEmpty) {
      return AppStrings.taskNameRequired;
    }
    if (value.trim().length < 3) {
      return AppStrings.taskNameTooShort;
    }
    if (value.trim().length > 100) {
      return AppStrings.taskNameTooLong;
    }
    return null;
  }

  /// Validates optional notes field
  /// Returns null if valid (notes are always optional)
  static String? validateNotes(String? value) {
    if (value != null && value.length > 500) {
      return 'Notes must be less than 500 characters';
    }
    return null;
  }

  /// Validates that a priority value is one of: high, medium, low
  static bool isValidPriority(String priority) {
    return ['high', 'medium', 'low'].contains(priority.toLowerCase());
  }

  /// Validates that a date value is one of: today, tomorrow
  static bool isValidDate(String date) {
    return ['today', 'tomorrow'].contains(date.toLowerCase());
  }
}
