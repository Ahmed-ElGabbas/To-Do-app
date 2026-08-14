import 'package:flutter/material.dart';
import 'package:tasko/core/network/api_error.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/core/network/models/comment.dart';
import 'package:tasko/shared/services/analytics_service.dart';
import 'package:tasko/shared/services/realtime_service.dart';

/// Comments on a single task. Mirrors the mutation pattern used by the other
/// collaboration providers: expose the API, keep loading/error state, and
/// optimistically update the in-memory list after each successful call.
class CommentProvider extends ChangeNotifier {
  CommentProvider({AppServices? services})
      : _services = services ?? AppServices.instance;

  final AppServices _services;

  List<Comment> _comments = [];
  String? _taskId;
  bool _isLoading = false;
  bool _isLoaded = false;
  bool _isSubmitting = false;
  String? _errorMessage;

  List<Comment> get comments => _comments;

  /// The task this provider is scoped to (set by [load]); null before load.
  String? get taskId => _taskId;
  bool get isLoading => _isLoading;
  bool get isLoaded => _isLoaded;
  bool get isSubmitting => _isSubmitting;
  String? get errorMessage => _errorMessage;

  Future<void> load(String taskId) async {
    _taskId = taskId;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      _comments = await _services.commentApi.list(taskId);
      _isLoaded = true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> addComment({
    required String taskId,
    required String body,
  }) async {
    _errorMessage = null;
    _isSubmitting = true;
    notifyListeners();
    try {
      final comment =
          await _services.commentApi.create(taskId: taskId, body: body);
      _comments.add(comment);
      AnalyticsService.commentAdded();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    } finally {
      _isSubmitting = false;
      notifyListeners();
    }
  }

  Future<bool> updateComment({
    required String id,
    required String body,
  }) async {
    _errorMessage = null;
    try {
      final updated = await _services.commentApi.update(id: id, body: body);
      final index = _comments.indexWhere((c) => c.id == id);
      if (index != -1) _comments[index] = updated;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    }
  }

  Future<bool> deleteComment(String id) async {
    _errorMessage = null;
    try {
      await _services.commentApi.delete(id);
      _comments.removeWhere((c) => c.id == id);
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    }
  }

  // ── Realtime (R7) ──────────────────────────────────────────────────────────

  /// Appends a live `comment.added` event (Section 3.3). The envelope payload
  /// is `{ comment, task }`; comments for another task are ignored, and a
  /// duplicate id (the echo of this device's own REST post) is dropped.
  /// Insertion keeps the list sorted by [Comment.createdAt].
  void applyRealtimeComment(RealtimeEnvelope envelope) {
    final commentData = envelope.payload['comment'];
    if (commentData is! Map<String, dynamic>) return;
    if (_taskId == null) return;
    final comment = Comment.fromJson(commentData);
    if (comment.taskId != _taskId) return;
    if (_comments.any((c) => c.id == comment.id)) return;
    final index =
        _comments.indexWhere((c) => c.createdAt.isAfter(comment.createdAt));
    if (index == -1) {
      _comments.add(comment);
    } else {
      _comments.insert(index, comment);
    }
    notifyListeners();
  }
}
