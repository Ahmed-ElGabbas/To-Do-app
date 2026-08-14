import 'package:flutter/material.dart';
import 'package:tasko/core/network/api_error.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/core/network/models/invitation.dart';
import 'package:tasko/core/network/models/member.dart';
import 'package:tasko/core/network/models/team.dart';
import 'package:tasko/shared/services/analytics_service.dart';
import 'package:tasko/shared/services/crashlytics_service.dart';
import 'package:tasko/shared/services/realtime_service.dart';

/// Teams the current user belongs to, plus the active-team selection that
/// scopes team-level features (members, invitations, analytics).
class TeamProvider extends ChangeNotifier {
  TeamProvider({AppServices? services})
      : _services = services ?? AppServices.instance;

  final AppServices _services;

  List<TeamWithRole> _teams = [];
  TeamWithRole? _activeTeam;
  final Set<String> _onlineUserIds = {};
  bool _isLoading = false;
  String? _errorMessage;

  List<TeamWithRole> get teams => _teams;
  TeamWithRole? get activeTeam => _activeTeam;
  String? get activeTeamId => _activeTeam?.id;
  bool get hasTeams => _teams.isNotEmpty;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  // ── Presence (R7) ──────────────────────────────────────────────────────────

  /// Members of the user's teams who are currently online, keyed by userId.
  Set<String> get onlineUserIds => Set.unmodifiable(_onlineUserIds);

  /// Whether a team member is currently online (presence dot, Section 10.3).
  bool isOnline(String userId) => _onlineUserIds.contains(userId);

  /// Applies a `user.online` / `user.offline` envelope (payload `{ userId }`).
  /// No-op when the membership set is unchanged.
  void applyPresence(RealtimeEnvelope envelope) {
    final userId = envelope.payload['userId'];
    if (userId is! String) return;
    final changed = envelope.eventName == 'user.online'
        ? _onlineUserIds.add(userId)
        : _onlineUserIds.remove(userId);
    if (changed) notifyListeners();
  }

  // ── Team CRUD ─────────────────────────────────────────────────────────────

  Future<void> loadTeams() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _teams = await _services.teamApi.list();
      if (_activeTeam != null) {
        _activeTeam =
            _teams.where((t) => t.id == _activeTeam!.id).firstOrNull;
      }
      if (_activeTeam == null && _teams.isNotEmpty) {
        _activeTeam = _teams.first;
      }
      if (_teams.isEmpty) _activeTeam = null;
      _syncActiveTeam();
    } on ApiException catch (e) {
      _errorMessage = e.message;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void selectTeam(String teamId) {
    final team = _teams.where((t) => t.id == teamId).firstOrNull;
    if (team != null) {
      _activeTeam = team;
      _syncActiveTeam();
      notifyListeners();
    }
  }

  Future<bool> createTeam({required String name, String? description}) async {
    _errorMessage = null;
    try {
      final team = await _services.teamApi.create(
        name: name,
        description: description,
      );
      _teams.add(TeamWithRole(
        id: team.id,
        name: team.name,
        description: team.description,
        ownerId: team.ownerId,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
        role: 'owner',
      ));
      _activeTeam = _teams.last;
      _syncActiveTeam();
      notifyListeners();
      AnalyticsService.teamCreated();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    }
  }

  Future<bool> updateTeam({
    required String teamId,
    String? name,
    String? description,
  }) async {
    _errorMessage = null;
    try {
      final team = await _services.teamApi.update(
        teamId,
        name: name,
        description: description,
      );
      final index = _teams.indexWhere((t) => t.id == teamId);
      if (index != -1) {
        _teams[index] = _withTeam(_teams[index], team);
      }
      if (_activeTeam?.id == teamId) _activeTeam = _teams[index];
      _syncActiveTeam();
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    }
  }

  Future<bool> deleteTeam(String teamId) async {
    _errorMessage = null;
    try {
      await _services.teamApi.delete(teamId);
      _teams.removeWhere((t) => t.id == teamId);
      if (_activeTeam?.id == teamId) {
        _activeTeam = _teams.isEmpty ? null : _teams.first;
      }
      _syncActiveTeam();
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    }
  }

  // ── Members ───────────────────────────────────────────────────────────────

  Future<List<TeamMember>> members(String teamId) async {
    try {
      return await _services.memberApi.list(teamId);
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return const [];
    }
  }

  Future<bool> addMember({
    required String teamId,
    required String email,
    String role = 'viewer',
  }) async {
    _errorMessage = null;
    try {
      await _services.memberApi.add(teamId: teamId, email: email, role: role);
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    }
  }

  Future<bool> changeMemberRole({
    required String teamId,
    required String userId,
    required String role,
  }) async {
    _errorMessage = null;
    try {
      await _services.memberApi.changeRole(
        teamId: teamId,
        userId: userId,
        role: role,
      );
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    }
  }

  Future<bool> removeMember({
    required String teamId,
    required String userId,
  }) async {
    _errorMessage = null;
    try {
      await _services.memberApi.remove(teamId: teamId, userId: userId);
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    }
  }

  // ── Invitations ───────────────────────────────────────────────────────────

  Future<List<Invitation>> invitations(String teamId) async {
    try {
      return await _services.invitationApi.list(teamId);
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return const [];
    }
  }

  Future<bool> createInvitation({
    required String teamId,
    required String email,
    String role = 'viewer',
  }) async {
    _errorMessage = null;
    try {
      await _services.invitationApi.create(
        teamId: teamId,
        email: email,
        role: role,
      );
      AnalyticsService.invitationSent();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    }
  }

  Future<bool> revokeInvitation({
    required String teamId,
    required String id,
  }) async {
    _errorMessage = null;
    try {
      await _services.invitationApi.revoke(teamId: teamId, id: id);
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /// Attaches the active team id (never its name) to crash reports, or 'none'
  /// when no team is selected. No-op before Crashlytics is initialized.
  void _syncActiveTeam() {
    CrashlyticsService.setActiveTeamId(_activeTeam?.id);
  }

  TeamWithRole _withTeam(TeamWithRole current, Team updated) => TeamWithRole(
        id: updated.id,
        name: updated.name,
        description: updated.description,
        ownerId: updated.ownerId,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        role: current.role,
      );
}
