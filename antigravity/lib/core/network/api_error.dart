import 'dart:io';

/// A typed error produced by the [ApiClient] when a request fails.
///
/// Carries the backend's error envelope fields (`code`, `message`,
/// `correlationId`, optional `details`) alongside the HTTP status code so
/// callers can react to specific conditions (e.g. expired session, missing
/// resource, quota exceeded) without string matching.
class ApiException implements Exception {
  const ApiException({
    required this.message,
    this.statusCode,
    this.code,
    this.correlationId,
    this.details,
    this.isNetworkError = false,
  });

  /// HTTP status code, when the server responded.
  final int? statusCode;

  /// Backend error code, e.g. `RESOURCE_NOT_FOUND`, `VALIDATION_ERROR`.
  final String? code;

  /// Human readable message from the server (or a fallback).
  final String message;

  /// Correlation id from the server, useful when reporting bugs.
  final String? correlationId;

  /// Optional structured payload (e.g. validation message list).
  final dynamic details;

  /// True when the request failed before reaching the server
  /// (no connectivity / timeout / DNS).
  final bool isNetworkError;

  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;
  bool get isValidation => statusCode == 422 || statusCode == 400;
  bool get isConflict => statusCode == 409;
  bool get isRateLimited => statusCode == 429;
  bool get isServerError =>
      statusCode != null && statusCode! >= 500 && !isNetworkError;

  @override
  String toString() =>
      'ApiException(statusCode: $statusCode, code: $code, message: $message)';
}

/// A request that could not be completed because the device is offline,
/// the server is unreachable, or a timeout was hit.
class NetworkException extends ApiException {
  const NetworkException(String message)
      : super(message: message, isNetworkError: true);
}

/// The session is no longer valid (missing/expired access token and refresh
/// failed). Callers should route the user back to the login screen.
class SessionExpiredException extends ApiException {
  const SessionExpiredException()
      : super(
          statusCode: 401,
          message: 'Your session has expired. Please log in again.',
        );
}

/// Maps the underlying error/status into the most specific [ApiException]
/// subtype when there is a match, otherwise a generic [ApiException].
ApiException mapApiError({
  int? statusCode,
  String? code,
  String? message,
  String? correlationId,
  dynamic details,
  bool isNetworkError = false,
}) {
  final normalizedCode = code ?? _codeForStatus(statusCode);

  if (isNetworkError) {
    return NetworkException(
      message ?? 'Unable to reach the server. Check your connection.',
    );
  }
  if (statusCode == 401 ||
      normalizedCode == 'UNAUTHORIZED' ||
      normalizedCode == 'SESSION_EXPIRED') {
    return SessionExpiredException();
  }
  return ApiException(
    statusCode: statusCode,
    code: normalizedCode,
    message: message ?? _fallbackMessage(normalizedCode),
    correlationId: correlationId,
    details: details,
  );
}

String? _codeForStatus(int? statusCode) {
  if (statusCode == null) return null;
  switch (statusCode) {
    case HttpStatus.badRequest:
      return 'VALIDATION_ERROR';
    case HttpStatus.unauthorized:
      return 'UNAUTHORIZED';
    case HttpStatus.forbidden:
      return 'FORBIDDEN';
    case HttpStatus.notFound:
      return 'NOT_FOUND';
    case HttpStatus.tooManyRequests:
      return 'RATE_LIMITED';
    case HttpStatus.conflict:
      return 'CONFLICT';
    case HttpStatus.internalServerError:
      return 'INTERNAL_ERROR';
    default:
      return 'HTTP_ERROR';
  }
}

String _fallbackMessage(String? code) {
  switch (code) {
    case 'UNAUTHORIZED':
      return 'Your session is no longer valid. Please log in again.';
    case 'FORBIDDEN':
      return 'You are not allowed to perform this action.';
    case 'RESOURCE_NOT_FOUND':
    case 'NOT_FOUND':
      return 'The requested resource was not found.';
    case 'VALIDATION_ERROR':
      return 'Some of the provided values are invalid.';
    case 'CONFLICT':
      return 'That resource already exists.';
    case 'RATE_LIMITED':
      return 'Too many requests. Please try again shortly.';
    case 'FILE_TOO_LARGE':
      return 'The file is too large to upload.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
