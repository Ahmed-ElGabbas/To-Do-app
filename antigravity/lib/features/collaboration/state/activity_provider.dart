import 'package:flutter/material.dart';
import 'package:tasko/core/network/api_error.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/core/network/models/activity_log.dart';

/// Feed of recent activity events for the current user (optionally filtered
/// to a team).
class ActivityProvider extends ChangeNotifier {
  ActivityProvider({AppServices? services})
      : _services = services ?? AppServices.instance;

  final AppServices _services;

  List<ActivityLogEntry> _entries = [];
  bool _isLoading = false;
  bool _isLoaded = false;
  String? _errorMessage;

  List<ActivityLogEntry> get entries => _entries;
  bool get isLoading => _isLoading;
  bool get isLoaded => _isLoaded;
  String? get errorMessage => _errorMessage;

  Future<void> load({int page = 1, int limit = 50, String? type}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final result = await _services.activityApi.list(
        page: page,
        limit: limit,
        type: type,
      );
      _entries = result.items;
      _isLoaded = true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
