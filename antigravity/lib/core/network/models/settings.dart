class UserSettings {
  const UserSettings({
    required this.userId,
    required this.darkMode,
    required this.notificationsEnabled,
    required this.language,
    required this.updatedAt,
  });

  final String userId;
  final bool darkMode;
  final bool notificationsEnabled;
  final String language; // 'en' | 'ar' | 'fr'
  final DateTime updatedAt;

  factory UserSettings.fromJson(Map<String, dynamic> json) => UserSettings(
        userId: json['userId'] as String,
        darkMode: json['darkMode'] as bool? ?? false,
        notificationsEnabled: json['notificationsEnabled'] as bool? ?? true,
        language: json['language'] as String? ?? 'en',
        updatedAt: DateTime.tryParse(json['updatedAt'] as String) ??
            DateTime.now(),
      );

  UserSettings copyWith({
    bool? darkMode,
    bool? notificationsEnabled,
    String? language,
  }) =>
      UserSettings(
        userId: userId,
        darkMode: darkMode ?? this.darkMode,
        notificationsEnabled:
            notificationsEnabled ?? this.notificationsEnabled,
        language: language ?? this.language,
        updatedAt: updatedAt,
      );
}
