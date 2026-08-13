import 'dart:convert';

import 'package:firebase_remote_config/firebase_remote_config.dart';
import 'package:flutter/foundation.dart';

/// Injectable facade over Firebase Remote Config so app code stays
/// unit-testable (the native plugin cannot be constructed in tests).
abstract class RemoteConfigReader {
  Future<void> setDefaults(Map<String, dynamic> defaults);

  Future<bool> fetchAndActivate();

  bool getBool(String key);

  int getInt(String key);

  String getString(String key);
}

/// Real Firebase Remote Config implementation.
class FirebaseRemoteConfigReader implements RemoteConfigReader {
  FirebaseRemoteConfigReader({FirebaseRemoteConfig? remoteConfig})
      : _remoteConfig = remoteConfig ?? FirebaseRemoteConfig.instance;

  final FirebaseRemoteConfig _remoteConfig;

  @override
  Future<void> setDefaults(Map<String, dynamic> defaults) =>
      _remoteConfig.setDefaults(defaults);

  @override
  Future<bool> fetchAndActivate() => _remoteConfig.fetchAndActivate();

  @override
  bool getBool(String key) => _remoteConfig.getBool(key);

  @override
  int getInt(String key) => _remoteConfig.getInt(key);

  @override
  String getString(String key) => _remoteConfig.getString(key);
}

/// Owns the Round 5 Remote Config flags. The service serves the
/// backend-matching defaults immediately and is refreshed in the background,
/// so the UI always reads a value without ever blocking startup.
///
/// The flags are UX guidance only — the backend remains the only validation
/// authority (the real limits live in SearchQueryDto / CreateTaskDto / the
/// file-upload size cap).
class RemoteConfigService {
  RemoteConfigService({
    RemoteConfigReader? reader,
    Duration fetchTimeout = const Duration(seconds: 3),
  })  : _reader = reader ?? FirebaseRemoteConfigReader(),
        _fetchTimeout = fetchTimeout;

  /// Set once in `main.dart`; the accessors below return flag defaults when
  /// null (widget tests).
  static RemoteConfigService? instance;

  /// Defaults mirror the backend's ground truth so the app behaves the same
  /// before the first successful fetch.
  static const _defaults = <String, dynamic>{
    'collaboration_features_enabled': true,
    'search_min_query_length': 1,
    'max_task_notes_length_client_hint': 2000,
    'social_login_providers_enabled':
        '{"google":true,"apple":false,"facebook":true}',
    'avatar_max_size_mb_client_hint': 5,
  };

  static const _defaultSocialProviders = <String, bool>{
    'google': true,
    'apple': false,
    'facebook': true,
  };

  final RemoteConfigReader _reader;
  final Duration _fetchTimeout;
  bool _loadStarted = false;

  /// Best-effort fetch + activate. Never throws: any failure (offline, native
  /// error, timeout) leaves the service serving its defaults.
  Future<void> load() async {
    if (_loadStarted) return;
    _loadStarted = true;
    try {
      await _reader.setDefaults(_defaults);
      await _reader.fetchAndActivate().timeout(_fetchTimeout);
    } catch (e) {
      debugPrint('RemoteConfigService: fetch failed, serving defaults: $e');
    }
  }

  /// Kills the Team/Member/Invitation/Comment UI (default: enabled).
  static bool get collaborationFeaturesEnabled =>
      _getBool('collaboration_features_enabled', true);

  /// Shortest query that triggers a search, matching the backend's
  /// `SearchQueryDto` `@MinLength(1)` (default: 1).
  static int get searchMinQueryLength =>
      _getInt('search_min_query_length', 1);

  /// Client-side notes length hint, matching the backend's notes
  /// `@MaxLength(2000)` (default: 2000).
  static int get maxTaskNotesLengthClientHint =>
      _getInt('max_task_notes_length_client_hint', 2000);

  /// Max avatar size in MB before the client refuses to upload, matching the
  /// backend's `MAX_FILE_SIZE_MB` (default: 5).
  static int get avatarMaxSizeMbClientHint =>
      _getInt('avatar_max_size_mb_client_hint', 5);

  /// Whether the given social provider button should be offered. Unknown or
  /// malformed JSON falls back to the per-provider default.
  static bool isSocialLoginProviderEnabled(String provider) {
    final raw = _getString(
      'social_login_providers_enabled',
      _encodeDefaults(),
    );
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) {
        return _defaultSocialProviders[provider] ?? false;
      }
      final value = decoded[provider];
      return value is bool
          ? value
          : (_defaultSocialProviders[provider] ?? false);
    } catch (_) {
      return _defaultSocialProviders[provider] ?? false;
    }
  }

  static String _encodeDefaults() => jsonEncode(_defaultSocialProviders);

  static bool _getBool(String key, bool fallback) {
    final service = instance;
    if (service == null) return fallback;
    try {
      return service._reader.getBool(key);
    } catch (_) {
      return fallback;
    }
  }

  static int _getInt(String key, int fallback) {
    final service = instance;
    if (service == null) return fallback;
    try {
      return service._reader.getInt(key);
    } catch (_) {
      return fallback;
    }
  }

  static String _getString(String key, String fallback) {
    final service = instance;
    if (service == null) return fallback;
    try {
      return service._reader.getString(key);
    } catch (_) {
      return fallback;
    }
  }
}
