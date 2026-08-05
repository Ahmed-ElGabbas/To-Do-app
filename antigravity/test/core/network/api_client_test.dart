import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/core/network/api_client.dart';
import 'package:tasko/core/network/api_error.dart';
import 'package:tasko/core/network/models/auth.dart';

import 'fake_adapter.dart';
import 'in_memory_token_storage.dart';

void main() {
  late InMemoryTokenStorage storage;
  late FakeAdapter adapter;
  late ApiClient client;

  ApiClient buildClient() {
    final dio = Dio(BaseOptions(baseUrl: 'http://test.local'))
      ..httpClientAdapter = adapter;
    return ApiClient(tokenStore: storage, dio: dio);
  }

  setUp(() {
    storage = InMemoryTokenStorage();
  });

  group('envelope unwrapping', () {
    test('returns data from a success envelope', () async {
      adapter = FakeAdapter(
        (options, _) => FakeAdapter.jsonBody(
          {
            'success': true,
            'data': {'id': '1'},
          },
          200,
        ),
      );
      client = buildClient();
      final response = await client.get('/tasks');
      final data = client.unwrap(response) as Map<String, dynamic>;
      expect(data['id'], '1');
    });

    test('returns null data for void endpoints', () async {
      adapter = FakeAdapter(
        (options, _) => FakeAdapter.jsonBody({'success': true}, 200),
      );
      client = buildClient();
      final response = await client.delete('/tasks/1');
      expect(client.unwrap(response), isNull);
    });

    test('throws typed ApiException on error envelope', () async {
      adapter = FakeAdapter(
        (options, _) => FakeAdapter.jsonBody(
          {
            'success': false,
            'error': {
              'code': 'RESOURCE_NOT_FOUND',
              'message': 'Task not found',
              'correlationId': 'cid-1',
            },
          },
          404,
        ),
      );
      client = buildClient();
      await expectLater(
        client.get('/tasks/nope'),
        throwsA(
          isA<ApiException>()
              .having((e) => e.code, 'code', 'RESOURCE_NOT_FOUND')
              .having((e) => e.statusCode, 'statusCode', 404)
              .having((e) => e.correlationId, 'correlationId', 'cid-1')
              .having((e) => e.isNotFound, 'isNotFound', true),
        ),
      );
    });

    test('returns raw body for skip-transform endpoints', () async {
      adapter = FakeAdapter(
        (options, _) => FakeAdapter.jsonBody({'status': 'ok'}, 200),
      );
      client = buildClient();
      final response = await client.get('/health');
      final data = client.unwrap(response) as Map<String, dynamic>;
      expect(data['status'], 'ok');
    });
  });

  group('auth interceptor', () {
    test('attaches bearer token to requests', () async {
      await storage.write(accessToken: 'tok-1', refreshToken: 'rf-1');
      String? seenAuth;
      adapter = FakeAdapter((options, _) {
        seenAuth = options.headers['Authorization'] as String?;
        return FakeAdapter.jsonBody(
          {'success': true, 'data': {}},
          200,
        );
      });
      client = buildClient();
      await client.get('/tasks');
      expect(seenAuth, 'Bearer tok-1');
    });

    test('refreshes once and retries on 401', () async {
      await storage.write(accessToken: 'old', refreshToken: 'rf-1');
      var refreshes = 0;
      adapter = FakeAdapter((options, attempt) {
        if (options.extra['skipRefresh'] == true) {
          refreshes++;
          return FakeAdapter.jsonBody(
            {
              'success': true,
              'data': {
                'accessToken': 'new-token',
                'refreshToken': 'rf-2',
              },
            },
            200,
          );
        }
        if (attempt == 1) {
          return FakeAdapter.jsonBody(
            {
              'success': false,
              'error': {
                'code': 'UNAUTHORIZED',
                'message': 'expired',
                'correlationId': 'cid',
              },
            },
            401,
          );
        }
        return FakeAdapter.jsonBody(
          {'success': true, 'data': {'ok': true}},
          200,
        );
      });

      client = buildClient();
      client.refreshCallback = () async {
        final refreshToken = await client.tokenStore.readRefreshToken();
        final response = await client.post(
          '/auth/refresh',
          data: {'refreshToken': refreshToken},
          options: Options(extra: {'skipRefresh': true}),
        );
        final tokens = AuthTokens.fromJson(
          client.unwrap(response) as Map<String, dynamic>,
        );
        await client.tokenStore.write(
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        );
        return (
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        );
      };

      final response = await client.get('/tasks');
      final data = client.unwrap(response) as Map<String, dynamic>;
      expect(data['ok'], true);
      expect(refreshes, 1);
      expect(adapter.requestCount, 3);
      expect(storage.accessToken, 'new-token');
    });

    test('invokes onSessionExpired when refresh fails', () async {
      await storage.write(accessToken: 'old', refreshToken: 'bad');
      var expired = 0;
      adapter = FakeAdapter(
        (options, _) => FakeAdapter.jsonBody(
          {
            'success': false,
            'error': {
              'code': 'UNAUTHORIZED',
              'message': 'expired',
              'correlationId': 'cid',
            },
          },
          401,
        ),
      );
      client = buildClient();
      client.refreshCallback = () async => throw const ApiException(message: 'refresh failed');
      client.onSessionExpired = () => expired++;

      await expectLater(
        client.get('/tasks'),
        throwsA(isA<ApiException>().having((e) => e.isUnauthorized, 'isUnauthorized', true)),
      );
      expect(expired, 1);
    });

    test('network errors surface as NetworkException', () async {
      adapter = FakeAdapter(
        (options, _) => throw DioException.connectionError(
          requestOptions: options,
          reason: 'connection refused',
        ),
      );
      client = buildClient();
      await expectLater(
        client.get('/tasks'),
        throwsA(isA<NetworkException>()),
      );
    });
  });
}
