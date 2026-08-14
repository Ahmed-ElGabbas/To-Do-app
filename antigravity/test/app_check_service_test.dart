import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/core/network/app_services.dart';
import 'package:tasko/shared/services/app_check_service.dart';

import 'core/network/in_memory_token_storage.dart';

void main() {
  tearDown(() {
    AppCheckService.instance = null;
  });

  test('attaches the X-Firebase-AppCheck header when a token is available',
      () async {
    AppCheckService.instance =
        AppCheckService()..tokenProvider = () async => 'app-check-token';

    RequestOptions? seen;
    final dio = Dio(BaseOptions(baseUrl: 'http://test.local'))
      ..httpClientAdapter = _CapturingAdapter((options) {
        seen = options;
        return ResponseBody.fromString('{}', 200);
      });
    AppServices(tokenStore: InMemoryTokenStorage(), dio: dio);

    await dio.get('/tasks');

    expect(seen?.headers['X-Firebase-AppCheck'], 'app-check-token');
  });

  test('omits the header when the service is not initialized', () async {
    RequestOptions? seen;
    final dio = Dio(BaseOptions(baseUrl: 'http://test.local'))
      ..httpClientAdapter = _CapturingAdapter((options) {
        seen = options;
        return ResponseBody.fromString('{}', 200);
      });
    AppServices(tokenStore: InMemoryTokenStorage(), dio: dio);

    await dio.get('/tasks');

    expect(seen?.headers.containsKey('X-Firebase-AppCheck'), isFalse);
  });

  test('omits the header when the token fetch fails (never breaks a request)',
      () async {
    AppCheckService.instance = AppCheckService()
      ..tokenProvider = () async => throw StateError('provider unavailable');

    RequestOptions? seen;
    final dio = Dio(BaseOptions(baseUrl: 'http://test.local'))
      ..httpClientAdapter = _CapturingAdapter((options) {
        seen = options;
        return ResponseBody.fromString('{}', 200);
      });
    AppServices(tokenStore: InMemoryTokenStorage(), dio: dio);

    final response = await dio.get('/tasks');

    expect(response.statusCode, 200);
    expect(seen?.headers.containsKey('X-Firebase-AppCheck'), isFalse);
  });

  test('omits the header when the provider returns null', () async {
    AppCheckService.instance = AppCheckService()..tokenProvider = () async => null;

    RequestOptions? seen;
    final dio = Dio(BaseOptions(baseUrl: 'http://test.local'))
      ..httpClientAdapter = _CapturingAdapter((options) {
        seen = options;
        return ResponseBody.fromString('{}', 200);
      });
    AppServices(tokenStore: InMemoryTokenStorage(), dio: dio);

    await dio.get('/tasks');

    expect(seen?.headers.containsKey('X-Firebase-AppCheck'), isFalse);
  });
}

class _CapturingAdapter implements HttpClientAdapter {
  _CapturingAdapter(this.handler);

  final ResponseBody Function(RequestOptions options) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return handler(options);
  }

  @override
  void close({bool force = false}) {}
}
