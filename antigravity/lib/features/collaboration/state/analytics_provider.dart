import 'package:flutter/material.dart';
import 'package:tasko/core/network/api_error.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/core/network/models/analytics.dart';

/// Aggregated completion statistics scoped to either the current user or an
/// active team.
class AnalyticsProvider extends ChangeNotifier {
  AnalyticsProvider({AppServices? services})
      : _services = services ?? AppServices.instance;

  final AppServices _services;

  AnalyticsSummary? _summary;
  bool _isLoading = false;
  String? _errorMessage;

  AnalyticsSummary? get summary => _summary;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> load({String? teamId}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _summary = await _services.analyticsApi.get(teamId: teamId);
    } on ApiException catch (e) {
      _errorMessage = e.message;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
