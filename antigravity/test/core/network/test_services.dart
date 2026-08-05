import 'package:dio/dio.dart';
import 'package:tasko/core/network/app_services.dart';

import 'fake_adapter.dart';
import 'in_memory_token_storage.dart';

/// Builds an `{ "success": true, "data": ... }` envelope response.
ResponseBody ok(Object? data, {int status = 200}) =>
    FakeAdapter.jsonBody({'success': true, 'data': data}, status);

/// Builds an error envelope response matching the backend convention.
ResponseBody failResponse(
  String code,
  String message, {
  int status = 400,
  dynamic details,
}) =>
    FakeAdapter.jsonBody(
      {
        'success': false,
        'error': {'code': code, 'message': message, 'details': details},
      },
      status,
    );

/// Wires an [AppServices] to a [FakeAdapter] so providers can run without a
/// real server. Handlers are keyed by `METHOD path` inside the closure.
class TestBackend {
  TestBackend(this.handler) {
    storage = InMemoryTokenStorage();
    adapter = FakeAdapter(handler);
    final dio = Dio(BaseOptions(baseUrl: 'http://test.local'))
      ..httpClientAdapter = adapter;
    services = AppServices(tokenStore: storage, dio: dio);
  }

  final ResponseBody Function(RequestOptions options, int attempt) handler;
  late final InMemoryTokenStorage storage;
  late final FakeAdapter adapter;
  late final AppServices services;
}
