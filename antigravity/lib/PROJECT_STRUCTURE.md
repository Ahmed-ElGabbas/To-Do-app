# Flutter Todo App — Project Structure & Implementation Guide

> **For Claude Code:** Read this file fully before writing any code. Follow the structure, design system, and conventions below exactly.

---

## Design System

**Theme:** White & Orange (default), supports Dark Mode  
**Primary Color:** `#FF9F00`  
**Background:** `#FFFFFF`  
**Surface:** `#F7F7F7`  
**Text Primary:** `#1A1A1A`  
**Text Secondary:** `#AAAAAA`  
**Font:** Poppins (300, 400, 500, 600, 700, 800)

---

## Folder Structure

```
lib/
│
├── core/
│   ├── constants/
│   │   ├── colors.dart
│   │   ├── strings.dart
│   │   └── sizes.dart
│   │
│   ├── theme/
│   │   ├── app_theme.dart
│   │   └── text_styles.dart
│   │
│   └── utils/
│       ├── helpers.dart
│       └── validators.dart
│
├── features/
│   │
│   ├── auth/
│   │   ├── presentation/
│   │   │   └── screens/
│   │   │       ├── login_screen.dart
│   │   │       └── signup_screen.dart
│   │   └── state/
│   │       └── auth_provider.dart
│   │
│   └── todo/
│       ├── data/
│       │   ├── models/
│       │   │   └── task_model.dart
│       │   ├── datasources/
│       │   │   └── local_data_source.dart
│       │   └── repositories/
│       │       └── task_repository_impl.dart
│       │
│       ├── domain/
│       │   ├── entities/
│       │   │   └── task.dart
│       │   ├── repositories/
│       │   │   └── task_repository.dart
│       │   └── usecases/
│       │       ├── add_task.dart
│       │       ├── get_tasks.dart
│       │       ├── delete_task.dart
│       │       └── update_task.dart
│       │
│       └── presentation/
│           ├── screens/
│           │   ├── splash_screen.dart
│           │   ├── home_screen.dart
│           │   ├── tasks_screen.dart
│           │   ├── calendar_screen.dart
│           │   ├── profile_screen.dart
│           │   ├── settings_screen.dart
│           │   ├── add_task_screen.dart
│           │   └── task_details_screen.dart
│           │
│           ├── widgets/
│           │   ├── task_card.dart
│           │   ├── custom_button.dart
│           │   ├── input_field.dart
│           │   ├── priority_chip.dart
│           │   ├── side_drawer.dart
│           │   └── main_scaffold.dart
│           │
│           └── state/
│               ├── task_provider.dart
│               ├── task_state.dart
│               └── settings_provider.dart
│
├── shared/
│   ├── services/
│   │   ├── local_storage_service.dart
│   │   └── email_service.dart
│   │
│   └── widgets/
│       └── loading_widget.dart
│
└── main.dart
```

---

## Screens Flow

```
SplashScreen (2s)
      ↓
LoginScreen ──────────────────→ SignupScreen
      ↓ (on login)
MainScaffold (BottomNav + Drawer)
  ├── HomeScreen       (tab 0)
  ├── TasksScreen      (tab 1)
  ├── CalendarScreen   (tab 2)
  └── ProfileScreen    (tab 3)
       └── SettingsScreen (from profile or drawer)
```

---

## Auth Feature

### login_screen.dart
- White background, Poppins font
- Orange app logo icon at top (rounded square)
- Title: "Welcome Back!" bold black, subtitle: "Sign in to manage your tasks" grey
- Email field (white bg, orange border on focus, rounded 12px)
- Password field with show/hide eye toggle icon in orange
- "Forgot Password?" text link aligned right in orange
- Orange filled "Sign In" button (full width, rounded 14px, bold white text)
- "Don't have an account? Sign Up" centered at bottom — "Sign Up" in orange
- On tap Sign In: validate fields, save user to SharedPreferences, navigate to MainScaffold
- No real backend — just local validation

### signup_screen.dart
- Same white & orange design as login
- Fields: Full Name, Email, Password, Phone Number, Country, Bio (optional)
- Profile picture picker (image_picker) — circular avatar at top with orange camera icon
- Orange "Create Account" button
- "Already have an account? Login" link in orange
- On signup: save all user data to SharedPreferences via AuthProvider
- Navigate to LoginScreen after success

### auth_provider.dart
- ChangeNotifier
- Stores: name, email, password, phone, country, bio, profileImagePath
- Methods: `signUp()`, `login()`, `logout()`, `updateProfile()`, `changeEmail()`, `changePassword()`
- Persists all data in SharedPreferences
- `isLoggedIn` bool — checked in SplashScreen to skip login if already logged in

---

## Bottom Navigation (main_scaffold.dart)

4 tabs with icons and labels:
- **Home** — house icon (tab 0)
- **Tasks** — checklist icon (tab 1)
- **Calendar** — calendar icon (tab 2)
- **Profile** — person icon (tab 3)

Style (exactly like reference image 3):
- White background bottom nav bar with elevated shadow and rounded top corners
- Active tab: orange icon + orange bold label + small orange dot below icon
- Inactive tab: grey icon + grey label
- Clean white style — no colored background bar
- The drawer hamburger icon (☰) appears in the AppBar top-left on all main screens

---

## Side Drawer (side_drawer.dart)

Dark background drawer (color: `#12121F`), white text — same dark style as reference image 1.

### Header section:
- Circular profile picture (from SharedPreferences path, or default orange avatar with initials)
- User's full name in white bold (18px)
- User's email in grey below name (13px)
- Subtle divider below header

### MAIN MENU section label (grey uppercase small text):
- 🏠 Home → navigate to HomeScreen (tab 0)
- ✅ Task Lists → navigate to TasksScreen (tab 1)
- 🗑️ Remove Tasks → show AlertDialog "Delete all tasks?" with Cancel / Delete buttons. On confirm: clear all tasks via TaskProvider

### ACTIONS section label:
- 💬 Send Feedback → use url_launcher to open:
  `mailto:ahmed.mahmoud.elgabbas@gmail.com?subject=App%20Feedback&body=Hi%2C%20I%20want%20to%20share%20feedback%20about%20the%20app.`
- 👥 Follow Us → open a modal bottom sheet (white card, rounded top 24px) with:
  - "Follow Us" title in orange bold at top left
  - Grey divider
  - Facebook row: Facebook icon (blue) + "Facebook" text + chevron → launches `https://www.facebook.com/share/1BHmoqjc5b/`
  - Instagram row: Instagram icon (pink/purple) + "Instagram" text + chevron → launches `https://www.instagram.com/elg.abbas?igsh=NWlvYzliNjdsb3Nz`
  - Twitter row: X/Twitter icon (black) + "Twitter" text + chevron → launches `https://x.com/A7med_ElGabbas`
  - Each row has a light grey divider between them
  - Use `url_launcher` `launchUrl()` with `LaunchMode.externalApplication`
- 👥 Invite Friends → use `share_plus` Share.share() with message: "Hey! Check out this amazing Todo app! [link]"
- ⚙️ Settings → navigate to SettingsScreen

All menu items: icon on left (24px, orange tint), label text white (15px), subtle divider between items, tap highlight in white/10% opacity.

---

## Screens Detail

### home_screen.dart
- AppBar: hamburger menu (opens drawer) on left, app name center, notification bell right
- Greeting card: "Good Morning, [Name] 👋" bold + date in grey + small progress summary
- TODAY section header (bold uppercase) + orange (+) button
- Task list for today with orange checkboxes
- TOMORROW section header + orange (+) button
- Task list for tomorrow
- Done tasks: strikethrough grey text, filled orange checkbox with white checkmark
- Orange FAB (+) at bottom right → navigate to AddTaskScreen

### tasks_screen.dart
- Title: "All My Tasks" bold
- Search bar at top (white bg, orange border on focus)
- Filter chips: All / Today / Tomorrow / Done / Pending (orange active chip)
- Shows ALL tasks grouped by date
- Each task card: orange checkbox, title, date badge, time, priority chip
- Swipe left on task card → red delete action
- Empty state: orange illustration + "No tasks yet! Add your first task"

### calendar_screen.dart
- Monthly calendar at top (use `table_calendar` package)
- Orange highlight circle for selected day
- Orange dot under days that have tasks
- Below calendar: list of tasks for selected day
- "No tasks for this day" empty state

### profile_screen.dart
- Circular profile picture (150px) — tap to change via image_picker
- Full Name below (24px bold)
- Email in grey
- Info cards: Phone, Country, Bio
- Orange "Edit Profile" button → dialog/sheet with editable fields
- "Settings" row with arrow → SettingsScreen
- Red "Logout" button at bottom → clears session → LoginScreen

### settings_screen.dart

**Account Settings section:**
- Change Email → bottom sheet: current password + new email fields + orange Save button
- Change Password → bottom sheet: old password + new password + confirm + orange Save button

**Notifications section:**
- "Push Notifications" toggle (orange Switch widget)

**Appearance section:**
- "Dark Mode" toggle (orange Switch) — toggles app theme immediately
- "Language" row → bottom sheet with 3 options:
  - 🇬🇧 English
  - 🇸🇦 العربية
  - 🇫🇷 Français
  - Selected option shows orange checkmark
  - Changing language calls `SettingsProvider.setLanguage()` and rebuilds app

**Contact Us section:**
- "Contact Us" row with mail icon → url_launcher opens:
  `mailto:ahmed.mahmoud.elgabbas@gmail.com?subject=Support%20Request`

---

## Key Implementation Notes

### colors.dart
```dart
class AppColors {
  static const Color primary = Color(0xFFFF9F00);
  static const Color background = Color(0xFFFFFFFF);
  static const Color surface = Color(0xFFF7F7F7);
  static const Color textPrimary = Color(0xFF1A1A1A);
  static const Color textSecondary = Color(0xFFAAAAAA);
  static const Color border = Color(0xFFEFEFEF);
  static const Color done = Color(0xFFCCCCCC);
  static const Color drawerBg = Color(0xFF12121F);
  static const Color drawerText = Color(0xFFFFFFFF);
  static const Color drawerSubtext = Color(0xFF8888AA);
  static const Color error = Color(0xFFE53935);
}
```

### task.dart (Entity)
```dart
class Task {
  final String id;
  final String title;
  final String time;
  final String date;       // "today", "tomorrow", or "YYYY-MM-DD"
  final bool isDone;
  final String priority;   // "high", "medium", "low"
  final String? notes;
  final DateTime createdAt;
}
```

### settings_provider.dart
```dart
class SettingsProvider extends ChangeNotifier {
  bool isDarkMode = false;
  bool notificationsEnabled = true;
  String language = 'en'; // 'en', 'ar', 'fr'

  void toggleDarkMode() { isDarkMode = !isDarkMode; _save(); notifyListeners(); }
  void toggleNotifications() { notificationsEnabled = !notificationsEnabled; _save(); notifyListeners(); }
  void setLanguage(String lang) { language = lang; _save(); notifyListeners(); }
  Future<void> loadSettings() async { /* load from SharedPreferences */ }
  Future<void> _save() async { /* save to SharedPreferences */ }
}
```

### email_service.dart
```dart
// Uses url_launcher
class EmailService {
  static const String _devEmail = 'ahmed.mahmoud.elgabbas@gmail.com';

  static Future<void> sendFeedback() async {
    final uri = Uri.parse('mailto:$_devEmail?subject=App%20Feedback&body=Hi%2C%20I%20want%20to%20share%20feedback.');
    await launchUrl(uri);
  }

  static Future<void> contactUs() async {
    final uri = Uri.parse('mailto:$_devEmail?subject=Support%20Request');
    await launchUrl(uri);
  }
}
```

### main.dart
```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => TaskProvider()..loadTasks()),
        ChangeNotifierProvider(create: (_) => AuthProvider()..loadUser()),
        ChangeNotifierProvider(create: (_) => SettingsProvider()..loadSettings()),
      ],
      child: Consumer<SettingsProvider>(
        builder: (context, settings, _) => MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          darkTheme: AppTheme.dark,
          themeMode: settings.isDarkMode ? ThemeMode.dark : ThemeMode.light,
          locale: Locale(settings.language),
          supportedLocales: [Locale('en'), Locale('ar'), Locale('fr')],
          home: SplashScreen(),
        ),
      ),
    ),
  );
}
```

---

## Dependencies (pubspec.yaml)

```yaml
dependencies:
  flutter:
    sdk: flutter
  flutter_localizations:
    sdk: flutter
  provider: ^6.1.1
  shared_preferences: ^2.2.2
  google_fonts: ^6.1.0
  uuid: ^4.3.3
  intl: ^0.19.0
  url_launcher: ^6.2.5
  image_picker: ^1.0.7
  share_plus: ^7.2.1
  table_calendar: ^3.1.1
```

---

## Platform Setup Required

### Android (android/app/src/main/AndroidManifest.xml) — add inside `<manifest>`:
```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.CAMERA"/>
```
And inside `<application>`:
```xml
<activity android:name="com.linusu.flutter_web_auth.CallbackActivity" android:exported="true">
  <intent-filter android:label="flutter_web_auth">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
  </intent-filter>
</activity>
```

### iOS (ios/Runner/Info.plist) — add:
```xml
<key>NSCameraUsageDescription</key>
<string>Used to set your profile picture</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Used to pick a profile picture</string>
<key>LSApplicationQueriesSchemes</key>
<array>
  <string>mailto</string>
  <string>https</string>
  <string>http</string>
</array>
```

---

## Conventions

- All widgets are `StatelessWidget` unless local UI state is needed
- Use `context.watch<Provider>()` for reactive UI, `context.read<Provider>()` for actions
- All strings in `AppStrings` — no hardcoded text (except dev email which goes in EmailService)
- All colors from `AppColors` — no hardcoded hex in widgets
- All spacing from `AppSizes` — no hardcoded numbers
- Format dates using `helpers.dart`
- Validate all form inputs using `validators.dart`
- Use `url_launcher` for ALL external links and mailto — never open browser manually
- `launchUrl()` must always use `LaunchMode.externalApplication` for social links