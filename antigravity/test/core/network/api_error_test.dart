import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/core/network/api_error.dart';

void main() {
  group('mapApiError', () {
    test('maps 401 to SessionExpiredException', () {
      final error = mapApiError(statusCode: 401);
      expect(error, isA<SessionExpiredException>());
      expect(error.isUnauthorized, isTrue);
    });

    test('maps network errors to NetworkException', () {
      final error = mapApiError(isNetworkError: true);
      expect(error, isA<NetworkException>());
      expect(error.isNetworkError, isTrue);
    });

    test('maps 404 with RESOURCE_NOT_FOUND code', () {
      final error = mapApiError(
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Task not found',
        correlationId: 'abc-123',
      );
      expect(error.isNotFound, isTrue);
      expect(error.code, 'RESOURCE_NOT_FOUND');
      expect(error.message, 'Task not found');
      expect(error.correlationId, 'abc-123');
    });

    test('preserves validation details', () {
      final details = [
        {'property': 'title', 'message': 'should not be empty'},
      ];
      final error = mapApiError(
        statusCode: 422,
        code: 'VALIDATION_ERROR',
        details: details,
      );
      expect(error.isValidation, isTrue);
      expect(error.details, details);
    });

    test('maps status code to fallback code when code absent', () {
      final error = mapApiError(statusCode: 409);
      expect(error.code, 'CONFLICT');
      expect(error.isConflict, isTrue);
    });

    test('rate limited detection', () {
      final error = mapApiError(statusCode: 429, code: 'RATE_LIMITED');
      expect(error.isRateLimited, isTrue);
    });

    test('server errors flagged', () {
      final error = mapApiError(statusCode: 503);
      expect(error.isServerError, isTrue);
    });

    test('SessionExpiredException reported even when code says UNAUTHORIZED',
        () {
      final error = mapApiError(statusCode: 401, code: 'UNAUTHORIZED');
      expect(error, isA<SessionExpiredException>());
    });
  });
}
