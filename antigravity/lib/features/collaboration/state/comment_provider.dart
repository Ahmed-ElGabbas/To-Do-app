import 'package:flutter/material.dart';
import 'package:tasko/core/network/api_error.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/core/network/models/comment.dart';

/// Comments on a single task. Mirrors the mutation pattern used by the other
/// collaboration providers: expose the API, keep loading/error state, and
/// optimistically update the in-memory list after each successful call.
class CommentProvider extends ChangeNotifier {
  CommentProvider({AppServices? services})
      : _services = services ?? AppServices.instance;

  final AppServices _services;

  List<Comment> _comments = [];
  bool _isLoading = false;
  bool _isLoaded = false;
  bool _isSubmitting = false;
  String? _errorMessage;

  List<Comment> get comments => _comments;
  bool get isLoading => _isLoading;
  bool get isLoaded => _isLoaded;
  bool get isSubmitting => _isSubmitting;
  String? get errorMessage => _errorMessage;

  Future<void> load(String taskId) async {
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
}
