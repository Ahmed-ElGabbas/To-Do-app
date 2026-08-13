import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:tasko/shared/services/remote_config_service.dart';

class _FakeReader implements RemoteConfigReader {
  final values = <String, dynamic>{};
  bool throwOnFetch = false;
  int fetchCalls = 0;
  Completer<void>? gate;

  @override
  Future<void> setDefaults(Map<String, dynamic> defaults) async {
    values.addAll(defaults);
  }

  @override
  Future<bool> fetchAndActivate() async {
    fetchCalls++;
    if (throwOnFetch) throw StateError('offline');
    if (gate != null) await gate!.future;
    return true;
  }

  @override
  bool getBool(String key) => values[key] as bool? ?? true;

  @override
  int getInt(String key) => values[key] as int? ?? 0;

  @override
  String getString(String key) => values[key] as String? ?? '';
}

void main() {
  tearDown(() {
    RemoteConfigService.instance = null;
  });

  test('accessors return the flag defaults when not initialized', () {
    expect(RemoteConfigService.collaborationFeaturesEnabled, isTrue);
    expect(RemoteConfigService.searchMinQueryLength, 1);
    expect(RemoteConfigService.maxTaskNotesLengthClientHint, 2000);
    expect(RemoteConfigService.avatarMaxSizeMbClientHint, 5);
    expect(RemoteConfigService.isSocialLoginProviderEnabled('google'), isTrue);
    expect(RemoteConfigService.isSocialLoginProviderEnabled('apple'), isFalse);
    expect(RemoteConfigService.isSocialLoginProviderEnabled('facebook'), isTrue);
  });

  test('load applies the defaults and fetches once', () async {
    final reader = _FakeReader();
    RemoteConfigService.instance = RemoteConfigService(reader: reader);

    await RemoteConfigService.instance!.load();
    await RemoteConfigService.instance!.load();

    expect(reader.values['search_min_query_length'], 1);
    expect(reader.values['collaboration_features_enabled'], isTrue);
    expect(reader.fetchCalls, 1);
  });

  test('load never throws when the fetch fails', () async {
    final reader = _FakeReader()..throwOnFetch = true;
    RemoteConfigService.instance = RemoteConfigService(reader: reader);

    await RemoteConfigService.instance!.load();

    expect(reader.fetchCalls, 1);
    expect(RemoteConfigService.collaborationFeaturesEnabled, isTrue);
  });

  test('load times out and keeps serving defaults', () async {
    final reader = _FakeReader()..gate = Completer<void>();
    RemoteConfigService.instance = RemoteConfigService(
      reader: reader,
      fetchTimeout: const Duration(milliseconds: 1),
    );

    await RemoteConfigService.instance!.load();

    expect(RemoteConfigService.searchMinQueryLength, 1);
  });

  test('flag getters read the remote values', () async {
    final reader = _FakeReader()
      ..values.addAll({
        'collaboration_features_enabled': false,
        'search_min_query_length': 2,
        'max_task_notes_length_client_hint': 500,
        'avatar_max_size_mb_client_hint': 10,
      });
    RemoteConfigService.instance = RemoteConfigService(reader: reader);

    expect(RemoteConfigService.collaborationFeaturesEnabled, isFalse);
    expect(RemoteConfigService.searchMinQueryLength, 2);
    expect(RemoteConfigService.maxTaskNotesLengthClientHint, 500);
    expect(RemoteConfigService.avatarMaxSizeMbClientHint, 10);
  });

  test('social providers are parsed from the JSON string', () async {
    final reader = _FakeReader()
      ..values['social_login_providers_enabled'] =
          '{"google":false,"apple":true}';
    RemoteConfigService.instance = RemoteConfigService(reader: reader);

    expect(RemoteConfigService.isSocialLoginProviderEnabled('google'), isFalse);
    expect(RemoteConfigService.isSocialLoginProviderEnabled('apple'), isTrue);
    expect(RemoteConfigService.isSocialLoginProviderEnabled('facebook'), isTrue);
    expect(RemoteConfigService.isSocialLoginProviderEnabled('unknown'), isFalse);
  });

  test('malformed provider JSON falls back to defaults', () async {
    final reader = _FakeReader()
      ..values['social_login_providers_enabled'] = 'not-json';
    RemoteConfigService.instance = RemoteConfigService(reader: reader);

    expect(RemoteConfigService.isSocialLoginProviderEnabled('google'), isTrue);
    expect(RemoteConfigService.isSocialLoginProviderEnabled('facebook'), isTrue);
  });
}
