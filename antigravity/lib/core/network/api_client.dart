import 'dart:async';

import 'package:dio/dio.dart';

import '../../shared/services/app_check_service.dart';
import '../config/api_config.dart';
import 'api_error.dart';
import 'token_store.dart';
/// Thin wrapper around [Dio] that encodes the Tasko backend conventions:
///
/// * Every successful response is `{ "success": true, "data": T }` and every
///   error is `{ "success": false, "error": { code, message, details,
///   correlationId } }`.
/// * Requests carry `Authorization: Bearer <accessToken>`.
/// * A 401 triggers a single token refresh (via [refreshCallback]) followed by
///   one retry of the original request. If the refresh fails the session is
///   considered expired and [onSessionExpired] is invoked.
///
/// Services built on top of this client call [unwrap] on responses to get the
/// `data` payload directly or throw a typed [ApiException].
class ApiClient {
  ApiClient({
    required this.tokenStore,
    Dio? dio,
  }) : dio = dio ?? Dio(_baseOptions()) {
    this.dio.interceptors.add(AuthInterceptor(this));
    this.dio.interceptors.add(AppCheckInterceptor());
  }

  final TokenStorage tokenStore;

  /// Assigned by the auth layer after construction. Returns the refreshed
  /// token pair and persists it through the [TokenStore].
  Future<({String accessToken, String refreshToken})> Function()?
      refreshCallback;

  /// Invoked when the session can no longer be recovered.
  void Function()? onSessionExpired;

  late final Dio dio;

  bool _refreshing = false;
  final List<Completer<String?>> _refreshWaiters = [];

  static BaseOptions _baseOptions() => BaseOptions(
        baseUrl: ApiConfig.baseUrl,
        connectTimeout: ApiConfig.connectTimeout,
        receiveTimeout: ApiConfig.receiveTimeout,
        sendTimeout: ApiConfig.sendTimeout,
        headers: {'Accept': 'application/json'},
      );

  /// Unwraps the envelope of a response already fetched with [request].
  ///
  /// Returns the `data` payload (may be `null` for void endpoints) or throws
  /// a typed [ApiException]. Handles raw (non-enveloped) responses such as the
  /// `@SkipTransform` health endpoints by returning the body unchanged.
  dynamic unwrap(Response<dynamic> response) {
    final body = response.data;
    if (body is Map<String, dynamic>) {
      if (body['success'] == true) {
        return body['data'];
      }
      if (body['success'] == false) {
        final error = body['error'];
        if (error is Map<String, dynamic>) {
          throw mapApiError(
            statusCode: response.statusCode,
            code: error['code'] as String?,
            message: error['message'] as String?,
            correlationId: error['correlationId'] as String?,
            details: error['details'],
          );
        }
      }
      if (body.containsKey('status')) {
        return body;
      }
    }
    throw mapApiError(
      statusCode: response.statusCode,
      message: 'Unexpected server response.',
    );
  }

  Future<Response<dynamic>> get(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return request(path, queryParameters: queryParameters, options: options);
  }

  Future<Response<dynamic>> post(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return request(
      path,
      method: 'POST',
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response<dynamic>> patch(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return request(
      path,
      method: 'PATCH',
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response<dynamic>> put(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return request(
      path,
      method: 'PUT',
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response<dynamic>> delete(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return request(
      path,
      method: 'DELETE',
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response<dynamic>> request(
    String path, {
    String? method,
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    final future = dio.request(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options?.copyWith(method: method) ?? Options(method: method),
    );
    return future.onError<DioException>((err, _) {
      final typed = err.error;
      if (typed is ApiException) {
        throw typed;
      }
      throw mapApiError(
        statusCode: err.response?.statusCode,
        message: 'Something went wrong. Please try again.',
      );
    });
  }

  /// Runs the refresh callback once, serializing concurrent 401 retries.
  Future<String?> refreshAccessToken() async {
    if (_refreshing) {
      final completer = Completer<String?>();
      _refreshWaiters.add(completer);
      return completer.future;
    }

    _refreshing = true;
    try {
      final callback = refreshCallback;
      if (callback == null) return null;
      final pair = await callback();
      return pair.accessToken;
    } catch (_) {
      return null;
    } finally {
      _refreshing = false;
      final waiters = List<Completer<String?>>.from(_refreshWaiters);
      _refreshWaiters.clear();
      for (final w in waiters) {
        w.complete(null);
      }
    }
  }
}

/// Attaches the bearer token and normalizes errors into typed [ApiException]s.
///
/// On a 401 it attempts one silent refresh and retries the original request.
class AuthInterceptor extends Interceptor {
  AuthInterceptor(this.client);

  final ApiClient client;

  static const _retriedKey = 'tasko.retried';

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await client.tokenStore.readAccessToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final response = err.response;
    final shouldAttemptRefresh = response?.statusCode == 401 &&
        err.requestOptions.extra[_retriedKey] != true &&
        err.requestOptions.extra['skipRefresh'] != true;

    if (shouldAttemptRefresh) {
      final newToken = await client.refreshAccessToken();
      if (newToken != null) {
        final options = err.requestOptions;
        options.extra[_retriedKey] = true;
        options.headers['Authorization'] = 'Bearer $newToken';
        try {
          final retry = await client.dio.fetch(options);
          return handler.resolve(retry);
        } catch (retryErr) {
          return handler.reject(
            _wrapAsDioException(
              _toApiError(retryErr, err.requestOptions),
              err.requestOptions,
            ),
          );
        }
      }
      client.onSessionExpired?.call();
    }

    handler.reject(
      _wrapAsDioException(
        _toApiError(err, err.requestOptions),
        err.requestOptions,
      ),
    );
  }

  DioException _wrapAsDioException(
    ApiException error,
    RequestOptions options,
  ) =>
      DioException(
        type: DioExceptionType.unknown,
        error: error,
        requestOptions: options,
      );

  ApiException _toApiError(Object error, RequestOptions options) {
    if (error is ApiException) return error;
    if (error is! DioException) {
      return mapApiError(message: 'Something went wrong. Please try again.');
    }
    final err = error;
    final response = err.response;
    if (err.type == DioExceptionType.connectionError ||
        err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.sendTimeout ||
        err.type == DioExceptionType.receiveTimeout) {
      return NetworkException('Unable to reach the server. Check your connection.');
    }

    if (response?.data is Map<String, dynamic>) {
      final body = response!.data as Map<String, dynamic>;
      if (body['success'] == false) {
        final errorBody = body['error'];
        if (errorBody is Map<String, dynamic>) {
          return mapApiError(
            statusCode: response.statusCode,
            code: errorBody['code'] as String?,
            message: errorBody['message'] as String?,
            correlationId: errorBody['correlationId'] as String?,
            details: errorBody['details'],
          );
        }
      }
    }

    return mapApiError(
      statusCode: response?.statusCode,
      code: options.extra['errorCode'] as String?,
      message: 'Something went wrong. Please try again.',
    );
  }
}

/// Attaches the Firebase App Check attestation token as `X-Firebase-AppCheck`,
/// additive to the `Authorization` header set by [AuthInterceptor].
///
/// When no token is available (service not initialized in tests, or the token
/// fetch failed) the request proceeds without the header — the backend's
/// AppCheckGuard records it as `missing` while in monitor mode, so this never
/// breaks a request.
class AppCheckInterceptor extends Interceptor {
  static const header = 'X-Firebase-AppCheck';

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await AppCheckService.instance?.getToken();
    if (token != null && token.isNotEmpty) {
      options.headers[header] = token;
    }
    handler.next(options);
  }
}
