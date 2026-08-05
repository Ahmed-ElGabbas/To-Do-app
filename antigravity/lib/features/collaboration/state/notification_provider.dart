import 'package:flutter/material.dart';
import 'package:tasko/core/network/api_error.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/core/network/models/notification.dart';

/// Inbox of backend-persisted notifications, with optimistic read-state
/// mutations that roll back on failure.
class NotificationProvider extends ChangeNotifier {
  NotificationProvider({AppServices? services})
      : _services = services ?? AppServices.instance;

  final AppServices _services;

  List<AppNotification> _notifications = [];
  bool _isLoading = false;
  bool _isLoaded = false;
  String? _errorMessage;

  List<AppNotification> get notifications => _notifications;
  bool get isLoading => _isLoading;
  bool get isLoaded => _isLoaded;
  String? get errorMessage => _errorMessage;

  int get unreadCount =>
      _notifications.where((n) => !n.isRead).length;

  Future<void> load() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final result = await _services.notificationApi.list();
      _notifications = result.items;
      _isLoaded = true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> markRead(String id) async {
    final index = _notifications.indexWhere((n) => n.id == id);
    if (index == -1) return;
    final previous = _notifications[index];
    _notifications[index] = _withRead(previous, true);
    notifyListeners();
    try {
      await _services.notificationApi.markRead(id);
    } on ApiException {
      _notifications[index] = previous;
      notifyListeners();
    }
  }

  Future<void> markAllRead() async {
    final previous = List<AppNotification>.of(_notifications);
    _notifications = [
      for (final n in _notifications) _withRead(n, true),
    ];
    notifyListeners();
    try {
      await _services.notificationApi.readAll();
    } on ApiException {
      _notifications = previous;
      notifyListeners();
    }
  }

  AppNotification _withRead(AppNotification n, bool read) => AppNotification(
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
        isRead: read,
        readAt: read ? n.readAt ?? DateTime.now() : null,
        createdAt: n.createdAt,
      );
}
