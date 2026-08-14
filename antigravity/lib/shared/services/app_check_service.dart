import 'package:firebase_app_check/firebase_app_check.dart';

/// Provides the Firebase App Check attestation token attached to outgoing API
/// requests as `X-Firebase-AppCheck`.
///
/// Follows the Crashlytics/Performance/RemoteConfig facade pattern: a nullable
/// static [instance] keeps widget/unit tests hermetic (null instance = no
/// header attached), and [tokenProvider] is injectable so tests can return a
/// canned token or simulate a failure.
///
/// Never breaks a request: a token fetch failure (e.g. Play Integrity not
/// available on a debug build) yields `null` and the request simply goes out
/// without the header — the backend's AppCheckGuard logs it as `missing` while
/// in monitor mode.
class AppCheckService {
  AppCheckService({this.tokenProvider});

  static AppCheckService? instance;

  /// Overridable in tests. Defaults to the Firebase SDK's cached token
  /// (`getToken()` with auto-refresh handled by the SDK).
  Future<String?> Function()? tokenProvider;

  Future<String?> getToken() async {
    final provider = tokenProvider ?? _defaultTokenProvider;
    try {
      return await provider();
    } catch (_) {
      return null;
    }
  }

  static Future<String?> _defaultTokenProvider() =>
      FirebaseAppCheck.instance.getToken();
}
