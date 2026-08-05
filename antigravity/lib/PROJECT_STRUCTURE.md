# Tasko — Project Structure & Implementation Guide

> **For AI coding agents:** Read this file fully before writing code. Follow the
> architecture, conventions, and response-contract rules below exactly.

---

## App Identity
- **App Name:** Tasko — Flutter client (`antigravity/`) talking to a NestJS API (`tasko-backend/`)
- **Slogan:** "Organize your day" (en) / "نظّم يومك" (ar) / "Organisez votre journée" (fr)
- **Icons / branding:** `assets/images/app_icon.png`
- **Stack:** Flutter 3.41.x / Dart 3.11.x (client) · NestJS + TypeORM + Postgres (backend)

---

## Architecture Overview (post Phase 5)

The app is **backend-driven**. All task/settings/auth state is synced to the
NestJS API; `SharedPreferences` is only a cache/fallback for settings and
local-only profile extras. There is no shared Firebase, and no local-first task
store anymore.

```
Flutter app ──(Dio, JWT Bearer)──► tasko-backend (NestJS REST API)
   │                                     │
   ├─ AuthProvider      (JWT login/signup/session/account)
   ├─ TaskProvider      (optimistic CRUD, rollback on ApiException)
   ├─ SettingsProvider  (syncs to /settings, keeps prefs cache)
   ├─ TeamProvider      (teams + members + invitations)
   ├─ NotificationProvider
   ├─ AnalyticsProvider
   ├─ ActivityProvider
   └─ AdminProvider     (admin-only)
```

### Response contract (MUST match the backend)
- Success: `{ "success": true, "data": T }` — `ApiClient.unwrap()` returns `data`.
- Void handlers emit **no** `data` field → unwrap returns `null`.
- `GET /files/avatar` may return `data: null` (no avatar yet).
- `GET /health` is raw (no envelope) and marked `@SkipTransform()`.
- Errors: `{ "success": false, "error": { code, message, details?, correlationId } }`
  → thrown as `ApiException(code, message, details?)`.
- `ApiClient` uses Dio's **default `validateStatus`** (throws on ≥400) so
  `AuthInterceptor.onError` drives the 401 → refresh → retry flow. Tests must
  mirror this (`validateStatus: (_) => true` was tried and reverted).

### Routing conventions
- Tasks/categories/tags/analytics: `teamId != null ? '/teams/$teamId/...' : '/...'`.
- Members/invitations are team-scoped only (`/teams/:id/members|invitations`).
- Client generates task UUIDs and `notificationId` (client-derived, never sent
  to the backend).

---

## Folder Structure

```
lib/
├── core/
│   ├── config/            api_config.dart          # baseUrl, timeouts
│   ├── constants/         colors.dart, sizes.dart, strings.dart
│   ├── localization/      app_localizations.dart   # en/ar/fr via l10n.get(key)
│   ├── network/
│   │   ├── api_client.dart                        # Dio + AuthInterceptor (refresh/retry)
│   │   ├── api_error.dart                         # ApiException + unwrap
│   │   ├── app_services.dart                      # single AppServices.instance holding all APIs
│   │   ├── token_store.dart                       # secure-storage token persistence
│   │   ├── models/        auth, user, task entities, team, member, invitation,
│   │   │                  notification, search*, analytics, activity_log, admin,
│   │   │                  category, tag, comment, settings, uploaded_file, pagination
│   │   └── services/      auth, user, task, settings, team, member, invitation,
│   │                      notification, search, analytics, activity, admin, file,
│   │                      category, tag, comment
│   ├── theme/             app_theme.dart (light/dark), text_styles.dart
│   └── utils/             helpers.dart, validators.dart, password_hasher.dart
│
├── features/
│   ├── auth/
│   │   ├── presentation/screens/   login_screen.dart, signup_screen.dart
│   │   └── state/                  auth_provider.dart
│   ├── collaboration/              # Phase 5.5 — teams & workspace features
│   │   ├── presentation/screens/   teams, team_details, notifications, search,
│   │   │                           analytics, activity, admin
│   │   └── state/                  team, notification, analytics, activity, admin providers
│   └── todo/
│       ├── data/          (legacy clean-architecture scaffolding — see Dead Code)
│       ├── domain/        entities/task.dart — Task entity
│       ├── presentation/
│       │   ├── screens/   splash, home, tasks, calendar, profile, settings,
│       │   │              edit_profile, add_task, task_details
│       │   ├── widgets/   main_scaffold, side_drawer, task_card, custom_button,
│       │   │              input_field, priority_chip
│       │   └── state/     task_provider.dart, settings_provider.dart
│
├── shared/services/       email_service, local_storage_service, notification_service
├── shared/widgets/        loading_widget
└── main.dart              AppServices wiring, refreshCallback, provider tree

test/
├── core/network/          fake_adapter.dart, test_services.dart (TestBackend),
│                          in_memory_token_storage.dart, api_client_test, api_error_test, models_test
├── *_provider_test.dart   per-provider unit tests (TestBackend-driven)
├── collaboration_screens_test.dart   widget tests for team/notification screens
├── task_provider_test.dart, settings_provider_test.dart, auth_provider_test.dart
├── widget_test.dart       full-app launch/navigation (TestBackend default routes)
└── local_data_source_isolation_test.dart
```

---

## Providers & State

| Provider | Role | Key methods |
|----------|------|-------------|
| `AuthProvider` | JWT session, account ops | `login`, `signUp`, `loadUser`, `logout`, `updateProfile`, `uploadAvatar`, `changeEmail`, `changePassword`, `forgotPassword`, `resetPassword`; getters `isAdmin`, `profile`, `avatarFileId`, `restorationDone` |
| `TaskProvider` | optimistic CRUD | `addTask`, `toggleDone`, `updateTask`, `deleteTask`, `clearAll`, `loadTasks`; filters `todayTasks`/`tomorrowTasks`/`completedCount` |
| `SettingsProvider` | user prefs | `loadSettings` (backend w/ prefs fallback), `toggleDarkMode`, `setLanguage`, `toggleNotifications` |
| `TeamProvider` | teams + members + invites | `loadTeams`, `selectTeam`, `createTeam`, `updateTeam`, `deleteTeam`, `members`, `addMember`, `changeMemberRole`, `removeMember`, `invitations`, `createInvitation`, `revokeInvitation` |
| `NotificationProvider` | inbox | `load`, `markRead` (optimistic, rollback), `markAllRead`; `unreadCount` |
| `AnalyticsProvider` | stats | `load({teamId})` |
| `ActivityProvider` | feed | `load({page, limit, type})` |
| `AdminProvider` | admin views | `loadStats`, `loadUsers`, `loadTeams`, `loadTeamDetail`, `updateUserRole` (optimistic) |

**Optimistic mutation pattern** (Task/Notification/Admin providers): update local
state → `notifyListeners()` → call API → on `ApiException` roll back and set
`_errorMessage`. 401 during a call triggers the interceptor refresh; `loadTasks()`
clears on 401.

---

## Screens Flow

```
SplashScreen → awaits auth.restorationDone
   ├─ signed out → LoginScreen / SignupScreen
   └─ signed in  → MainScaffold (4 bottom tabs)
        ├── HomeScreen      (tab 0) — today/tomorrow + progress card
        ├── TasksScreen     (tab 1) — all tasks, search, filter chips
        ├── CalendarScreen  (tab 2) — date-scoped add
        └── ProfileScreen   (tab 3) — avatar upload (FileApi), account actions

SideDrawer (from any tab):
   Main menu: Home, Task Lists, Remove Tasks
   Workspace: My Teams → TeamsScreen → TeamDetailsScreen
              Notifications → NotificationsScreen
              Search → SearchScreen
              Analytics → AnalyticsScreen
              Activity → ActivityScreen
              Admin Panel (only when auth.isAdmin) → AdminScreen
   Actions: Send Feedback, Follow Us, Invite Friends, Settings
```

---

## Localization

- All UI text lives in `core/localization/app_localizations.dart` under `_strings`
  with `en`, `ar`, `fr` maps. Keys fall back to English, then the raw key.
- Read in `build`: `AppLocalizations.of(context)` (watches `SettingsProvider`).
- Read in event handlers (sheets/dialogs triggered by taps): **must use**
  `AppLocalizations.read(context)` — `.of` calls `context.watch`, which throws
  outside `build`.

---

## Testing

- **`TestBackend(handler)`** (`test/core/network/test_services.dart`) wires an
  `AppServices` to a `FakeAdapter` keyed by `'METHOD path'` with `ok(...)` /
  `failResponse(...)` envelope helpers. All provider/screen tests reuse it.
- Provider unit tests assert optimistic apply + rollback + `_errorMessage`.
- Handler closures must dispatch by method when a test both loads and mutates.
- Run: `flutter analyze` (must be zero issues) and `flutter test` (full suite).
- Backend suites (`npm run build/lint/test/e2e`) require Docker/Postgres — **not
  installed in this environment**; flag in reports.

---

## Conventions

- `context.watch<P>()` for UI reads; `context.read<P>()` in callbacks.
- All providers take `AppServices? services` and default to `AppServices.instance`.
- All colors/spacing from `AppColors`/`AppSizes`; Poppins via `GoogleFonts`;
  `AppTextStyles` for text.
- Dark-mode aware (theme.primaryColor amber `#FF9F00`, colorScheme surfaces).
- New screens are pushed routes with an auto back button; only the 4 tabs use
  the drawer hamburger (`scaffoldKey`).
- Best-effort subsystems (notifications, image picking, date parsing) log via
  `debugPrint` with context — never fully silent `catch (_) {}`.

---

## Dead Code / Known Gaps

- `features/todo/data`, `features/todo/domain/usecases` are legacy clean-architecture
  scaffolding (bypassed by `TaskProvider` → `TaskApi`). Keep only if a future
  refactor adopts them.
- Backend integration/e2e suites are Docker-gated and cannot run on this machine.
- Avatar path is stored locally (`_profileImagePath`) while `avatarFileId` comes
  from the backend profile; `uploadAvatar` uploads via `FileApi.uploadAvatar`.
- Settings cache in SharedPreferences is a fallback only; backend is source of truth.
