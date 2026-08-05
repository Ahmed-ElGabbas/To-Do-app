/// Application-wide API configuration.
///
/// The backend base URL is injected at build/run time through
/// `--dart-define=API_BASE_URL=https://api.example.com`. When the define is
/// absent the client falls back to the local development server.
class ApiConfig {
  ApiConfig._();

  /// Backend base URL, without a trailing slash.
  ///
  /// Override with: `flutter run --dart-define=API_BASE_URL=https://...`
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);
  static const Duration sendTimeout = Duration(seconds: 15);

  static const Duration accessTokenRefreshBuffer = Duration(minutes: 1);
}
