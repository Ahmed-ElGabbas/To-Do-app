import 'package:flutter/material.dart';
import 'package:tasko/core/network/api_error.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/core/network/models/search.dart';
import 'package:tasko/shared/services/analytics_service.dart';
import 'package:tasko/shared/services/performance_service.dart';
import 'package:tasko/shared/services/remote_config_service.dart';

/// Search results for a query. Owns loading/error state so screens can stay
/// presentational (debouncing stays in the widget; network + state live here).
class SearchProvider extends ChangeNotifier {
  SearchProvider({AppServices? services})
      : _services = services ?? AppServices.instance;

  final AppServices _services;

  SearchResults? _results;
  bool _isLoading = false;
  String? _errorMessage;

  SearchResults? get results => _results;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> search(String query) async {
    final trimmed = query.trim();
    final minLength = RemoteConfigService.searchMinQueryLength;
    if (trimmed.isEmpty || trimmed.length < minLength) {
      _results = null;
      _isLoading = false;
      _errorMessage = null;
      notifyListeners();
      return;
    }
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      await PerformanceService.trace('search_query', () async {
        _results = await _services.searchApi.search(q: trimmed);
      });
      AnalyticsService.searchPerformed(resultCount: _results?.total ?? 0);
    } on ApiException catch (e) {
      _errorMessage = e.message;
      _results = null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
