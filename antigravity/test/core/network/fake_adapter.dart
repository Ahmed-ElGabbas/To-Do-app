import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// A [HttpClientAdapter] that returns canned responses without touching the
/// network. Handlers are keyed by `METHOD path` and may be dynamic per call.
class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.handler);

  /// Returns the response for a request, or throws if no handler matches.
  final ResponseBody Function(RequestOptions options, int attempt) handler;

  int requestCount = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requestCount++;
    return handler(options, requestCount);
  }

  @override
  void close({bool force = false}) {}

  static ResponseBody jsonBody(Object data, int statusCode) =>
      ResponseBody.fromString(
        json.encode(data),
        statusCode,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );

  static ResponseBody empty(int statusCode) => ResponseBody.fromString(
        '{}',
        statusCode,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );
}
