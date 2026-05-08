# Tasko App — Project Structure & Implementation Guide

> **For Claude Code:** Read this file fully before writing any code. Follow the structure, design system, and conventions below exactly.

---

## App Identity
- **App Name:** Tasko (everywhere — AndroidManifest, Info.plist, UI, AppBar, Splash)
- **App Slogan:** "Organize your day"
- **App Icon:** assets/images/app_icon.png (books stack image)

---

## Implementation Status — All 8 Features Complete ✅

| # | Feature | Status | Key Files |
|---|---------|--------|-----------|
| 1 | Splash Screen Icon (app_icon.png) | ✅ Done | `splash_screen.dart` |
| 2 | Persistent Login (SharedPreferences) | ✅ Done | `auth_provider.dart`, `splash_screen.dart` |
| 3 | Add Task Works (optimistic UI) | ✅ Done | `task_provider.dart`, `add_task_screen.dart` |
| 4 | Calendar Add Task with Date | ✅ Done | `calendar_screen.dart`, `add_task_screen.dart` |
| 5 | Completed Counter (real-time) | ✅ Done | `task_provider.dart`, `home_screen.dart` |
| 6 | Local Notifications (no Firebase) | ✅ Done | `notification_service.dart`, `AndroidManifest.xml` |
| 7 | Profile Picture Change | ✅ Done | `profile_screen.dart` |
| 8 | Flat Task Row Style | ✅ Done | `task_card.dart` |

---

## Design System

**Theme:** White & Orange (default), supports Dark Mode
**Primary Color:** `#FF9F00`
**Background Light:** `#FFFFFF`
**Background Dark:** `#1A1A1A`
**Surface Light:** `#F7F7F7`
**Surface Dark:** `#2A2A2A`
**Text Primary Light:** `#1A1A1A`
**Text Primary Dark:** `#FFFFFF`
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
│   │   ├── strings.dart         # AppStrings + AppL10n (en/ar/fr)
│   │   └── sizes.dart
│   │
│   ├── theme/
│   │   ├── app_theme.dart       # light + dark ThemeData
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
│       │   │   └── task_model.dart        # TaskModel.fromJson/toJson/encode/decode
│       │   ├── datasources/
│       │   │   └── local_data_source.dart # getTasks/saveTasks/addTask/updateTask/deleteTask
│       │   └── repositories/
│       │       └── task_repository_impl.dart
│       │
│       ├── domain/
│       │   ├── entities/
│       │   │   └── task.dart              # Task entity (id,title,time,date,isDone,priority,notes,notificationId)
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
│           │   ├── splash_screen.dart     # ✅ Shows app_icon.png 120x120 rounded; routes on isLoggedIn
│           │   ├── home_screen.dart       # ✅ Consumer<TaskProvider>; todayTasks/tomorrowTasks; completed counter
│           │   ├── tasks_screen.dart      # ✅ All tasks; search; filter chips; completedCount chip
│           │   ├── calendar_screen.dart   # ✅ TableCalendar; FAB adds task for selected date (YYYY-MM-DD)
│           │   ├── profile_screen.dart    # ✅ image_picker integration; camera/gallery bottom sheet; persists path
│           │   ├── settings_screen.dart   # ✅ Dark mode toggle; language picker; account settings
│           │   ├── edit_profile_screen.dart
│           │   ├── add_task_screen.dart   # ✅ Validates title; supports 'today'/'tomorrow'/'YYYY-MM-DD'; green ✓ FAB
│           │   └── task_details_screen.dart
│           │
│           ├── widgets/
│           │   ├── task_card.dart         # ✅ Flat style: checkbox + name + time; no shadows/borders
│           │   ├── custom_button.dart
│           │   ├── input_field.dart
│           │   ├── priority_chip.dart
│           │   ├── side_drawer.dart
│           │   └── main_scaffold.dart     # ✅ backgroundColor:white; SystemUIOverlayStyle set in main.dart
│           │
│           └── state/
│               ├── task_provider.dart     # ✅ Optimistic UI: list updated before I/O; allTasks alias; completedCount
│               ├── task_state.dart
│               └── settings_provider.dart
│
├── shared/
│   ├── services/
│   │   ├── local_storage_service.dart    # ✅ SINGLETON pattern — init() in main.dart, reused everywhere
│   │   ├── email_service.dart
│   │   └── notification_service.dart     # ✅ init()+scheduleTaskNotification()+cancelNotification()+cancelAll()
│   │
│   └── widgets/
│       └── loading_widget.dart
│
└── main.dart                             # ✅ SystemChrome white nav bar; LocalStorageService.init(); NotificationService.init()
```

---

## Screens Flow

```
SplashScreen (2s) → checks isLoggedIn
      ├── true  → MainScaffold (skip login forever)
      └── false → LoginScreen → SignupScreen
                      ↓ (on login/signup — saved permanently)
              MainScaffold (BottomNav + Drawer)
                ├── HomeScreen       (tab 0)
                ├── TasksScreen      (tab 1)
                ├── CalendarScreen   (tab 2)  ← FAB adds task for selected date
                └── ProfileScreen    (tab 3)  ← tap avatar to change profile picture
                     └── SettingsScreen
```

---

## Feature Details

### FEATURE 1 — Splash Screen Icon
- `splash_screen.dart`: `Image.asset('assets/images/app_icon.png', width:120, height:120)` in `ClipRRect`
- Fallback to "T" letter if image fails to load
- Animation: fade + scale (1.2s) → 2s delay → route based on `isLoggedIn`

### FEATURE 2 — Persistent Login
- `AuthProvider.signUp()` and `AuthProvider.login()` both set `isLoggedIn = true` and persist to SharedPreferences
- `SplashScreen` reads `context.read<AuthProvider>().isLoggedIn`
- `AuthProvider.logout()` sets `isLoggedIn = false` → only triggered by Logout button in ProfileScreen

### FEATURE 3 — Add Task (Instant UI)
**Key pattern in `task_provider.dart`:**
```dart
Future<void> addTask(Task task) async {
  _tasks.add(task);      // 1. Instant in-memory update
  notifyListeners();     // 2. UI rebuilds immediately
  try {
    await _addTask(task); // 3. Persist to SharedPreferences
    // schedule notification
  } catch (e) {
    _tasks.removeWhere((t) => t.id == task.id); // rollback on failure
    notifyListeners();
  }
}
```
- Same optimistic pattern for `toggleDone()`, `deleteTask()`, `updateTask()`
- `LocalStorageService` is a **singleton** — `factory LocalStorageService() => _instance` — ensures the instance initialized in `main()` is always reused

### FEATURE 4 — Calendar Add Task with Date
- `CalendarScreen` has a FAB that calls `_addTaskForDate(context)`
- Converts `_selectedDay` to `'today'`, `'tomorrow'`, or `'yyyy-MM-dd'` string
- `AddTaskScreen(initialDate: dateArg)` accepts all three formats
- When `initialDate` is YYYY-MM-DD (`_isCustomDate == true`), a third chip shows the formatted date
- `TaskProvider.todayTasks` / `tomorrowTasks` also resolve YYYY-MM-DD strings matching today/tomorrow

### FEATURE 5 — Completed Counter
- `TaskProvider.completedCount` getter: `_tasks.where((t) => t.isDone).length`
- `home_screen.dart`: `Consumer<TaskProvider>` rebuilds greeting card with `$doneTasks / $total completed`
- `tasks_screen.dart`: shows `$completedCount tasks completed ✓` chip — updates in real time via same Consumer

### FEATURE 6 — Local Notifications
- `NotificationService.init()` called in `main()` before `runApp()`
- Requests Android 13+ permission on first launch
- `scheduleTaskNotification()` called inside `TaskProvider.addTask()` after persistence
- `cancelNotification()` called inside `TaskProvider.deleteTask()` using `task.notificationId`
- `task.notificationId` = `id.hashCode.abs() % 2147483647` (stable, derived from task UUID)
- Silent fail for all notification ops (best-effort, never crashes app)

**AndroidManifest.xml permissions:**
```xml
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
<uses-permission android:name="android.permission.VIBRATE"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>
```

### FEATURE 7 — Profile Picture Change
- `ProfileScreen` renders `_TappableAvatar` (StatelessWidget)
- Tapping opens a `showModalBottomSheet` with Camera / Gallery options
- `ImagePicker().pickImage(source: source, imageQuality: 80)` returns path
- Path saved via `AuthProvider.updateProfile(profileImagePath: picked.path)`
- Displayed via `Image.file(File(auth.profileImagePath))` with initials fallback

### FEATURE 8 — Flat Task Row Style
`task_card.dart` uses `InkWell` + plain `Container(color: AppColors.background)`:
- No `BoxShadow`, no `border`, no card elevation
- Layout: `[checkbox 24x24] [title + time (Expanded)] [priority strip 4x36]`
- Pending: empty orange square checkbox
- Done: filled orange checkbox with white `✓` + strikethrough title + grey time

---

## Auth Feature

### auth_provider.dart
- ChangeNotifier
- Fields: name, email, password, phone, country, bio, **profileImagePath**, isLoggedIn
- Methods: `signUp()`, `login()`, `logout()`, `updateProfile()`, `changeEmail()`, `changePassword()`, `loadUser()`
- ALL data persisted in SharedPreferences immediately via `_save()`
- `isLoggedIn=true` saved on first login/signup and NEVER cleared unless user taps Logout
- `loadUser()` called on app start to restore full session

---

## Bottom Navigation (main_scaffold.dart)

4 tabs:
- **Home** — house icon (tab 0)
- **Tasks** — checklist icon (tab 1)
- **Calendar** — calendar icon (tab 2)
- **Profile** — person icon (tab 3)

Style:
- `backgroundColor: AppColors.white` on Scaffold
- White nav bar with rounded top corners, subtle shadow
- Active: orange icon + orange bold label + small orange dot below
- Hamburger (☰) in AppBar top-left opens SideDrawer on all tabs

---

## Task Entity

```dart
class Task {
  final String id;           // UUID v4
  final String title;
  final String time;         // "06:00 AM"
  final String date;         // "today", "tomorrow", or "YYYY-MM-DD"
  final bool isDone;
  final String priority;     // "high", "medium", "low"
  final String? notes;
  final DateTime createdAt;
  final int notificationId;  // id.hashCode.abs() % 2147483647
}
```

---

## TaskProvider Getters

```dart
List<Task> get tasks       // all tasks (raw list)
List<Task> get allTasks    // alias for tasks
List<Task> get todayTasks  // date == 'today' OR YYYY-MM-DD matching today
List<Task> get tomorrowTasks // date == 'tomorrow' OR YYYY-MM-DD matching tomorrow
int get completedCount     // tasks.where((t) => t.isDone).length
```

---

## LocalStorageService — Singleton Pattern

```dart
class LocalStorageService {
  static final LocalStorageService _instance = LocalStorageService._internal();
  factory LocalStorageService() => _instance;
  LocalStorageService._internal();
  late SharedPreferences _prefs;
  Future<void> init() async { _prefs = await SharedPreferences.getInstance(); }
  // read/write/delete/clear/hasKey
}
```

**CRITICAL:** `LocalStorageService().init()` is called ONCE in `main()`. All providers use
`LocalStorageService()` factory which returns the same singleton with the initialized `_prefs`.

---

## Notification Service

```dart
class NotificationService {
  static Future<void> init() async { ... }                          // call in main()
  static Future<void> scheduleTaskNotification({id, title, scheduledTime}) async { ... }
  static Future<void> cancelNotification(int id) async { ... }
  static Future<void> cancelAll() async { ... }
  static DateTime? parseTaskDateTime(String time, String date) { ... }
}
```

`parseTaskDateTime` handles `'today'`, `'tomorrow'`, and `'YYYY-MM-DD'` date strings.

---

## Localization Strings (3 languages)

All text supports English / Arabic / French via `AppL10n.t(key, lang)`.

```
hello:        "Hello"          / "مرحبا"        / "Bonjour"
tasks:        "Tasks"          / "المهام"        / "Tâches"
add_task:     "Add New Task"   / "إضافة مهمة"   / "Ajouter une tâche"
settings:     "Settings"       / "الإعدادات"    / "Paramètres"
profile:      "Profile"        / "الملف الشخصي"/ "Profil"
home:         "Home"           / "الرئيسية"     / "Accueil"
calendar:     "Calendar"       / "التقويم"      / "Calendrier"
today:        "TODAY"          / "اليوم"        / "AUJOURD'HUI"
tomorrow:     "TOMORROW"       / "غداً"         / "DEMAIN"
completed:    "completed"      / "مكتملة"       / "terminées"
organize:     "Organize your day" / "نظّم يومك" / "Organisez votre journée"
tasko:        "Tasko"          / "Tasko"        / "Tasko"
dark_mode:    "Dark Mode"      / "الوضع الداكن" / "Mode sombre"
language:     "Language"       / "اللغة"        / "Langue"
logout:       "Logout"         / "تسجيل الخروج" / "Déconnexion"
save:         "Save"           / "حفظ"          / "Enregistrer"
```

---

## Platform Setup

### AndroidManifest.xml (complete)
```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
<uses-permission android:name="android.permission.VIBRATE"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>

<!-- Inside application tag -->
<receiver android:exported="false" android:name="com.dexterous.flutterlocalnotifications.ScheduledNotificationReceiver"/>
<receiver android:exported="false" android:name="com.dexterous.flutterlocalnotifications.ScheduledNotificationBootReceiver">
  <intent-filter>
    <action android:name="android.intent.action.BOOT_COMPLETED"/>
    <action android:name="android.intent.action.MY_PACKAGE_REPLACED"/>
    <action android:name="android.intent.action.QUICKBOOT_POWERON"/>
  </intent-filter>
</receiver>
```

### iOS Info.plist
```xml
<key>CFBundleDisplayName</key>
<string>Tasko</string>
<key>NSCameraUsageDescription</key>
<string>Used to set your profile picture</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Used to pick a profile picture</string>
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
  flutter_local_notifications: ^17.0.0
  timezone: ^0.9.4

dev_dependencies:
  flutter_launcher_icons: ^0.13.1

flutter_icons:
  android: true
  ios: true
  image_path: "assets/images/app_icon.png"

flutter:
  assets:
    - assets/images/
```

---

## Conventions

- All widgets `StatelessWidget` unless local UI state needed
- `context.watch<P>()` for UI, `context.read<P>()` for actions
- All colors from `AppColors` — zero hardcoded hex in widgets
- All spacing from `AppSizes` — zero hardcoded numbers in widgets
- `LocalStorageService` is a singleton — never call `init()` more than once
- Tasks saved to SharedPreferences on EVERY change via optimistic pattern
- `isLoggedIn` saved permanently — user never re-logs unless they tap Logout
- Dark mode and language change take effect INSTANTLY without restart
- `flutter analyze` passes with zero issues ✅