import 'package:flutter/material.dart';
import 'package:tasko/core/network/api_error.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/core/network/models/admin.dart';

/// Admin-only views over users and teams.
class AdminProvider extends ChangeNotifier {
  AdminProvider({AppServices? services})
      : _services = services ?? AppServices.instance;

  final AppServices _services;

  AdminStats? _stats;
  List<AdminUser> _users = [];
  List<AdminTeam> _teams = [];
  AdminTeamDetail? _teamDetail;
  bool _isLoading = false;
  String? _errorMessage;
  int _usersPage = 1;
  int _teamsPage = 1;
  bool _hasMoreUsers = true;
  bool _hasMoreTeams = true;

  AdminStats? get stats => _stats;
  List<AdminUser> get users => _users;
  List<AdminTeam> get teams => _teams;
  AdminTeamDetail? get teamDetail => _teamDetail;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get hasMoreUsers => _hasMoreUsers;
  bool get hasMoreTeams => _hasMoreTeams;

  Future<void> loadStats() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _stats = await _services.adminApi.stats();
    } on ApiException catch (e) {
      _errorMessage = e.message;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadUsers({String? q, bool reset = false}) async {
    if (reset) {
      _usersPage = 1;
      _users = [];
      _hasMoreUsers = true;
    }
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final result = await _services.adminApi.users(
        page: _usersPage,
        limit: 20,
        q: q,
      );
      _users = reset ? result.items : [..._users, ...result.items];
      _hasMoreUsers = result.items.isNotEmpty;
      _usersPage++;
    } on ApiException catch (e) {
      _errorMessage = e.message;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadTeams({String? q, bool reset = false}) async {
    if (reset) {
      _teamsPage = 1;
      _teams = [];
      _hasMoreTeams = true;
    }
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final result = await _services.adminApi.teams(
        page: _teamsPage,
        limit: 20,
        q: q,
      );
      _teams = reset ? result.items : [..._teams, ...result.items];
      _hasMoreTeams = result.items.isNotEmpty;
      _teamsPage++;
    } on ApiException catch (e) {
      _errorMessage = e.message;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadTeamDetail(String id) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _teamDetail = await _services.adminApi.getTeam(id);
    } on ApiException catch (e) {
      _errorMessage = e.message;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> updateUserRole({required String id, required String role}) async {
    _errorMessage = null;
    final index = _users.indexWhere((u) => u.id == id);
    final previous = index != -1 ? _users[index] : null;
    if (index != -1) {
      _users[index] = _withRole(_users[index], role);
      notifyListeners();
    }
    try {
      final updated = await _services.adminApi.updateUserRole(id: id, role: role);
      if (index != -1) _users[index] = updated;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      if (index != -1 && previous != null) _users[index] = previous;
      notifyListeners();
      _errorMessage = e.message;
      return false;
    }
  }

  AdminUser _withRole(AdminUser user, String role) => AdminUser(
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: role,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      );
}
