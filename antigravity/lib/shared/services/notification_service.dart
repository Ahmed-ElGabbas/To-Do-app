import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:timezone/data/latest_all.dart' as tz_data;

class NotificationService {
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  static Future<void> init() async {
    tz_data.initializeTimeZones();

    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );
    await _plugin.initialize(initSettings);

    // Request Android 13+ permission
    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
  }

  static Future<void> scheduleTaskNotification({
    required int id,
    required String title,
    required DateTime scheduledTime,
  }) async {
    try {
      if (scheduledTime.isBefore(DateTime.now())) return;

      const androidDetails = AndroidNotificationDetails(
        'tasko_tasks',
        'Task Reminders',
        channelDescription: 'Notifications for your Tasko tasks',
        importance: Importance.high,
        priority: Priority.high,
        icon: '@mipmap/ic_launcher',
      );
      const notifDetails = NotificationDetails(
        android: androidDetails,
        iOS: DarwinNotificationDetails(),
      );

      final scheduledTZ = tz.TZDateTime.from(scheduledTime, tz.local);
      await _plugin.zonedSchedule(
        id,
        title,
        "It's time for your task!",
        scheduledTZ,
        notifDetails,
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
      );
    } catch (e) {
      // Silent fail — notification scheduling is best-effort
      debugPrint('NotificationService: failed to schedule notification (id=$id): $e');
    }
  }

  static Future<void> cancelNotification(int id) async {
    try {
      await _plugin.cancel(id);
    } catch (e) {
      debugPrint('NotificationService: failed to cancel notification (id=$id): $e');
    }
  }

  static Future<void> cancelAll() async {
    try {
      await _plugin.cancelAll();
    } catch (e) {
      debugPrint('NotificationService: failed to cancel all notifications: $e');
    }
  }

  /// Converts a time string like "06:30 AM" and a date ("today"/"tomorrow")
  /// into an absolute DateTime for scheduling.
  static DateTime? parseTaskDateTime(String time, String date) {
    try {
      final now = DateTime.now();
      final isToday = date.toLowerCase() == 'today';
      final isTomorrow = date.toLowerCase() == 'tomorrow';
      DateTime base;
      if (isToday) {
        base = DateTime(now.year, now.month, now.day);
      } else if (isTomorrow) {
        base = DateTime(now.year, now.month, now.day + 1);
      } else {
        base = DateTime.parse(date);
      }
      final parts = time.split(' ');
      final timeParts = parts[0].split(':');
      int hour = int.parse(timeParts[0]);
      final int minute = int.parse(timeParts[1]);
      final String period = parts.length > 1 ? parts[1].toUpperCase() : 'AM';
      if (period == 'PM' && hour != 12) hour += 12;
      if (period == 'AM' && hour == 12) hour = 0;
      return base.add(Duration(hours: hour, minutes: minute));
    } catch (e) {
      debugPrint('NotificationService: failed to parse task date/time (date="$date", time="$time"): $e');
      return null;
    }
  }
}
