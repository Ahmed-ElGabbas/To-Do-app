import 'package:intl/intl.dart';

class Helpers {
  Helpers._();

  /// Formats a DateTime into a time string like "06:00 AM"
  static String formatTime(DateTime dateTime) {
    return DateFormat('hh:mm a').format(dateTime);
  }

  /// Formats a DateTime into a date string like "May 03, 2026"
  static String formatDate(DateTime dateTime) {
    return DateFormat('MMM dd, yyyy').format(dateTime);
  }

  /// Returns "today" or "tomorrow" based on the date
  static String getDateLabel(DateTime dateTime) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final tomorrow = today.add(const Duration(days: 1));
    final target = DateTime(dateTime.year, dateTime.month, dateTime.day);

    if (target == today) {
      return 'today';
    } else if (target == tomorrow) {
      return 'tomorrow';
    }
    return DateFormat('MMM dd').format(dateTime);
  }

  /// Builds a time string from hour, minute, and period
  static String buildTimeString(int hour, int minute, String period) {
    final h = hour.toString().padLeft(2, '0');
    final m = minute.toString().padLeft(2, '0');
    return '$h:$m $period';
  }

  /// Parses a time string like "06:00 AM" into components
  static Map<String, dynamic> parseTimeString(String time) {
    final parts = time.split(' ');
    final timeParts = parts[0].split(':');
    return {
      'hour': int.parse(timeParts[0]),
      'minute': int.parse(timeParts[1]),
      'period': parts.length > 1 ? parts[1] : 'AM',
    };
  }

  /// Gets the current date label (today/tomorrow)
  static bool isToday(String date) {
    return date.toLowerCase() == 'today';
  }

  /// Checks if date string is tomorrow
  static bool isTomorrow(String date) {
    return date.toLowerCase() == 'tomorrow';
  }

  /// Capitalizes the first letter of a string
  static String capitalize(String text) {
    if (text.isEmpty) return text;
    return text[0].toUpperCase() + text.substring(1).toLowerCase();
  }

  /// Returns a greeting based on time of day
  static String getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) {
      return 'Good Morning';
    } else if (hour < 17) {
      return 'Good Afternoon';
    } else {
      return 'Good Evening';
    }
  }
}
