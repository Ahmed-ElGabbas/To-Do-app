# Tasko — Firebase Integration Plan

**Status:** Planning document only, now approved for execution. Firebase is additive — it does not replace the existing JWT auth system, StorageService, or notification system anywhere in this plan.

## ⚠️ Blocking prerequisite — RESOLVED
Package/Bundle ID is now `com.tasko.app` (already applied to android/app/build.gradle.kts and ios/Runner.xcodeproj as part of Round 0).

## 1. Firebase Project Setup — DONE (Round 0)
Two projects created: `tasko-staging` (default, local dev) and `tasko-production-14179`. Android + iOS apps registered via `flutterfire configure` with package/bundle id `com.tasko.app`. `.gitignore` updated for google-services.json / GoogleService-Info.plist / lib/firebase_options*.dart. firebase_core added with a no-op Firebase.initializeApp() in main.dart. Committed as the Firebase Round 0 commit.

New Flutter dependencies needed going forward (verify live versions at add-time):
firebase_auth, firebase_messaging, firebase_storage (NOT building — see decision 3), firebase_crashlytics, firebase_remote_config, firebase_app_check, firebase_performance, firebase_analytics, google_sign_in, sign_in_with_apple, flutter_facebook_auth.

## 2. Social Login — Architecture (Round 1 — Google now)

**Exact flow:** Flutter uses the Firebase Auth client SDK (google_sign_in feeding into firebase_auth) to complete Google's native sign-in and obtain a Firebase ID token → Flutter sends that ID token to a new backend endpoint POST /auth/social-login → backend verifies server-side via the Firebase Admin SDK (admin.auth().verifyIdToken()) → backend finds-or-creates a UserEntity matching by verified email → backend calls the EXISTING AuthService.issueTokens(userId) — zero changes to signup/login/issueTokens themselves → backend returns the same { user, tokens } shape as /auth/login → Flutter stores it exactly like password login.

Client-side detail: GoogleSignIn().signIn() → Google ID token → FirebaseAuth.instance.signInWithCredential(GoogleAuthProvider.credential(idToken: ...)) → get the Firebase ID token via user.getIdToken() → send THAT to the backend.

**New backend surface:**
- POST /auth/social-login, @Public(), SocialLoginDto { idToken: string, provider: enum('google'|'apple'|'facebook') }. Response: identical shape to /auth/login. Errors: 401 UNAUTHORIZED for invalid/expired token (reuse existing error class/code).
- New FirebaseAdminService in src/infrastructure/firebase/ — thin injectable wrapper around admin.auth().verifyIdToken(), lazy-initialized from new env vars FIREBASE_SERVICE_ACCOUNT_PATH (or base64 FIREBASE_SERVICE_ACCOUNT_JSON) + FIREBASE_PROJECT_ID, wired through configuration.ts / validation.schema.ts / .env.example exactly like JWT_SECRET / STORAGE_DRIVER.
- New firebase-admin npm dependency.

**Backend status — DONE.** Shipped as part of this session:
- `FirebaseModule`/`FirebaseAdminService` (`src/infrastructure/firebase/`) — lazy init, `verifyIdToken()` wraps SDK errors as 401, and "not configured" boots cleanly as 401. Unit spec covers lazy-init once-per-process, base64 + file service-account loading, and error wrapping.
- `POST /auth/social-login` on `AuthController` (throttled 5/60s, @Public), `SocialLoginDto { idToken, provider }`, `AuthService.socialLogin()` — verifies the token, checks `sign_in_provider` matches the requested provider, requires `email_verified`, then find-or-create by verified email. New users get the invitation-accept style unusable Argon2id hash (no schema change to password_hash), `markEmailVerified`, and `authProvider` set; existing accounts are linked without re-verification. Reuses `issueTokens()`/`toPublic()` untouched.
- `users.auth_provider` column (varchar(20) NOT NULL DEFAULT 'password') via migration `1786400000000-AuthProviderColumn` (driver-agnostic, up/down) + spec; baseline/findings migration specs updated to include it.
- `AuthProvider` enum (`src/common/constants/auth-provider.enum.ts`), optional `authProvider` on `UserService.create()`.
- Config: `FIREBASE_PROJECT_ID`/`FIREBASE_SERVICE_ACCOUNT_PATH`/`FIREBASE_SERVICE_ACCOUNT_JSON` in configuration.ts, validation.schema.ts, .env.example; registered in AppModule.
- Tests: 6 `socialLogin` unit tests + FirebaseAdminService unit spec + integration coverage (create-and-reuse, link existing password account, provider mismatch, unverified email, 400s) using a stubbed `verifyIdToken` via `bootstrapApp({ firebaseAdmin })`. Unit: 291 pass. Integration: 24 pass. Lint clean (0 errors). Jest maps `firebase-admin/*` to CJS stubs under `test/mocks/` because `firebase-admin` 14 depends on ESM-only `jose`.

**Schema change — minimal:** UserEntity.password_hash is NOT NULL. Do NOT make it nullable. Instead, reuse the exact precedent already in InvitationService.accept() (stub invited users get an unusable random Argon2id hash via argon2.hash(randomBytes(24)...)) — same pattern for a social-login-only user. Zero schema change to password_hash.

One additive column: users.auth_provider (varchar(20), NOT NULL DEFAULT 'password', values password|google|apple|facebook) — for support/analytics visibility only, not required for the auth flow itself. Migration following the exact DatabaseFindingsFixes pattern (up/down, spec test, driver-agnostic).

**Account linking — decided (see Part 2, Decision 4 for Facebook's different rule):**
Google and Apple: match and link by verified email, always, in both directions (password-first-then-Google, or Google-first-then-password-attempt — the latter correctly fails "Invalid email or password" since there's no real password set; point them at forgot-password, the existing flow, to set one).

**Apple-specific requirements (for the later Apple round, not Google):** Apple Developer Program membership ($99/year) required. "Sign In with Apple" capability must be enabled in Xcode + Apple Developer Console. SHA-256 nonce handling (sign_in_with_apple package handles it). Apple App Review policy: if you offer Google or Facebook, Apple requires you also offer Sign In with Apple.

**Flutter-side changes:** New Google sign-in button on login_screen.dart/register_screen.dart. New AuthProvider.socialLogin(idToken, provider) method, same try/catch-ApiException/notifyListeners() pattern as the existing login().

**Flutter status — DONE** (google_sign_in 7.2.0 + firebase_auth 6.5.7, resolved via `flutter pub add` to match firebase_core 4.13.0):
- `GoogleSignInService` (`lib/features/auth/services/google_sign_in_service.dart`) — google_sign_in 7.x flow (`GoogleSignIn.instance` → `initialize()` once → `authenticate()`), maps canceled/interrupted/uiUnavailable to `GoogleSignInCancelledException`, exchanges the Google ID token for a Firebase credential via `FirebaseAuth.instance` and returns `user.getIdToken()`. `FirebaseAuth.instance` is lazy so widget tests (no Firebase init) still construct the LoginScreen.
- `GoogleSignInButton` (`lib/features/auth/presentation/widgets/google_sign_in_button.dart`) — outlined CTA with a ShaderMask four-color Google "G", localized label, shared loading state.
- `AuthApi.socialLogin({ idToken, provider })` → `POST /auth/social-login`, `AuthProvider.socialLogin(idToken, provider)` mirroring `login()`.
- "Continue with Google" button + "or" divider added below the main CTA on login and signup screens; success path reuses the existing `TaskProvider.loadTasks()` + `MainScaffold` navigation.
- Localization keys added for all 3 locales (en/ar/fr): `continue_with_google`, `or`, `google_sign_in_failed`.
- Verification: `flutter analyze` clean, `flutter test` 112/112 pass, `flutter build apk --debug` succeeds. Native config files already present from Round 0 (`google-services.json`, `GoogleService-Info.plist`); Android `com.google.gms.google-services` plugin already applied.

## 3. Firebase Cloud Messaging — Architecture (later round, not Round 1)
user_devices table already has the right shape (token varchar(512) unique, platform enum) — no schema change needed. Trigger path: existing NotificationService's event handler gets ONE more step at the end — call FcmPushService.send() via admin.messaging().sendEachForMulticast() — zero changes to the event bus, event types, or notifications table. Foreground/background/terminated handling required in Flutter (FCM behaves differently in each); reuse the already-present flutter_local_notifications dependency for foreground display. Failure handling matches the existing "log and swallow, never fail the originating write" pattern from task-event-bus.service.ts; additionally, delete the UserDeviceEntity row on an FCM "token no longer valid" error.

## 4. Firebase Storage — NOT BUILDING (Decision 3, Part 2)
The existing local/s3 StorageService drivers remain the only two. Do not add a firebase driver.

## 5. Crashlytics — Architecture (later round) — DONE (Round 3)
Flutter-side only, no backend surface. Initialize in main.dart after Firebase.initializeApp(); FlutterError.onError + PlatformDispatcher.instance.onError handlers. setUserIdentifier(userId) (UUID, never email) + custom key for active teamId — matching the backend's existing no-PII logging discipline.

**Flutter status — DONE** (firebase_crashlytics 5.2.7):
- `CrashlyticsService` (`lib/shared/services/crashlytics_service.dart`) — `init()` installs both fatal-error handlers (FlutterError.onError → recordFlutterFatalError, PlatformDispatcher.onError → recordError) behind an injectable `CrashReporter` facade so nothing is constructed in widget tests; `CrashlyticsService.instance` is null in tests so provider hooks no-op.
- `AuthProvider` attaches `setUserIdentifier(userId)` (the backend UUID, never email) on restore/login/signup/socialLogin and clears it (`''`) on logout.
- `TeamProvider` attaches `setCustomKey('active_team_id', …)` (id only, never the team name) on load/select/create/update/delete; `'none'` when no team is selected.
- Verification: `flutter analyze` clean, `flutter test` 137/137 pass, `flutter build apk --debug` succeeds.

## 6. Deep Linking for Invitations — Architecture (later round) — NOT Dynamic Links
Firebase Dynamic Links is fully shut down (since Aug 25, 2025) — confirmed live, do not use it. Use native Android App Links + iOS Universal Links instead (assetlinks.json / apple-app-site-association served from APP_BASE_URL/.well-known/). No change needed to InvitationService's link generation — the existing /invitations/:token path is already what App Links intercept. Deferred linking (auto-resume after install) is a real, separate gap — optional GET /invitations/pending?email= endpoint can close it later if wanted.

**Status — CODE-COMPLETE, ACTIVATION-PENDING (Round 4).** Same caveat category as Round 1b (Apple): the code is finished and tested, but it is not live-verifiable until external prerequisites exist. Until then every placeholder below means the OS will not route links into the app:
- A real HTTPS domain replacing the `tasko.example` placeholder in three places that must agree: backend `DEEP_LINK_BASE_URL`, Android `appLinksUrlHost` manifestPlaceholder (build.gradle.kts), and the iOS `applinks:` entitlement (Runner.entitlements).
- Apple Team ID (Apple Developer account) for the `apple-app-site-association` appID (`<APPLE_TEAM_ID>.com.tasko.app`).
- Release-keystore SHA-256 fingerprint in `ANDROID_CERT_FINGERPRINTS` (assetlinks.json currently ships the debug fingerprint).

**Backend — DONE** (verified: lint clean, 326/326 tests pass):
- `DeepLinkController` serves `GET /.well-known/assetlinks.json` and `GET /.well-known/apple-app-site-association` (`@Public @SkipTransform`, flat framework-standard bodies — not the `{success,data}` envelope), generated by `DeepLinkService` from `DEEP_LINK_BASE_URL` / `APPLE_TEAM_ID` / `ANDROID_CERT_FINGERPRINTS`.
- `GET /invitations/:token` content-negotiates on `Accept`: browsers (`text/html`) get a self-contained `LandingPageService` HTML page (escaped interpolations, "Open in the Tasko app" deep link, HTML error page for 404/409); API clients get the normal JSON envelope. `POST /invitations/:token/accept|decline` remain public. Invite emails now link to `DEEP_LINK_BASE_URL` instead of `APP_BASE_URL`.
- Integration spec `test/integration/deep-link.integration-spec.ts`.

**Flutter — DONE** (verified: `flutter analyze` clean, `flutter test` 157/157 pass, `flutter build apk --debug` succeeds):
- `DeepLinkService` (`lib/shared/services/deep_link_service.dart`) — `app_links` subscription for warm start, `getInitialLink()` buffered for terminated start, flushed from SplashScreen after session restore (public accept works signed-out).
- `InvitationAcceptScreen` (`lib/features/collaboration/presentation/screens/invitation_accept_screen.dart`) — pending invite with Accept/Decline, resolved-state card, l10n keys en/ar/fr.
- Android `<intent-filter android:autoVerify>` on MainActivity (host via `appLinksUrlHost` placeholder, single source of truth); iOS `Runner.entitlements` (`applinks:` placeholder) + `CODE_SIGN_ENTITLEMENTS` + `FlutterDeepLinkingEnabled` in Info.plist.

## 7. Remote Config — Architecture — DONE (Round 5)
Five flags: collaboration_features_enabled, search_min_query_length, max_task_notes_length_client_hint, social_login_providers_enabled (JSON per-provider toggle), avatar_max_size_mb_client_hint. Never a second validation authority — UX guidance only, backend rules remain the real limits.

**Flutter status — DONE** (firebase_remote_config 6.5.6):
- `RemoteConfigService` (`lib/shared/services/remote_config_service.dart`) — best-effort `load()` (`setDefaults` + `fetchAndActivate()` with a 3s timeout, never throws), static flag accessors that fall back to bundled defaults when uninitialized (keeps widget tests hermetic).
- Flag consumers: `side_drawer.dart` hides My Teams; `task_details_screen.dart` hides the comments entry; `search_provider.dart` skips queries shorter than `search_min_query_length`; `add_task_screen.dart` clamps notes via `max_task_notes_length_client_hint` (new optional `InputField.maxLength`); `login_screen.dart`/`signup_screen.dart` gate each social button + hide the "or" divider when `social_login_providers_enabled` disables them; `profile_screen.dart`/`signup_screen.dart` reject oversized avatars with a localized `avatar_too_large` SnackBar.

## 8. Firebase App Check — Architecture — DONE (Round 6, monitor mode)
Layers on top of, never instead of, JWT auth + Throttler. AppCheckGuard sits in the same APP_GUARD chain, positioned before JwtAuthGuard. Monitor mode first (not enforce) since firebase_app_check is still pre-1.0 (latest 0.4.6). Enforce mode is a deliberate, separate future decision — the APP_CHECK_ENFORCE env switch is wired now but stays off.

**Backend status — DONE** (firebase-admin 14.2.0, monitor mode):
- `AppCheckGuard` (`src/common/guards/app-check.guard.ts`) in the APP_GUARD chain: `ThrottlerGuard → AppCheckGuard → JwtAuthGuard → RolesGuard → TeamMembershipGuard`. Monitor mode: verifies `X-Firebase-AppCheck` via the Admin SDK (`verifyToken`) and logs `app_check_pass` / `app_check_reject` / `app_check_missing` against the request's correlation ID, but ALWAYS allows the request. `APP_CHECK_ENFORCE=true` (default false) switches to real enforcement (401 on missing/invalid) with no code change.
- `getAppCheck()` accessor added to `FirebaseAdminService` (`src/infrastructure/firebase/firebase-admin.service.ts`), lazily initialized exactly like `getMessaging()`.
- Skipped entirely (no log/enforce) for `/health*` and `/.well-known/*` (infra probes and verification crawlers never carry tokens) and whenever Firebase is not configured (dev/test).
- Verification: `nest build` clean, `npm run lint` 0 errors, `npm test` 336/336, `test:e2e` 44/44, `test:integration` 37/37 — including a spec proving monitor mode never blocks a request with a missing or invalid token.

**Flutter status — DONE** (firebase_app_check 0.4.6 — still pre-1.0 as the plan predicted):
- `FirebaseAppCheck.instance.activate(providerAndroid: AndroidPlayIntegrityProvider, providerApple: AppleDeviceCheckProvider)` in `main.dart` right after `Firebase.initializeApp()`.
- `AppCheckService` (`lib/shared/services/app_check_service.dart`) — injectable token provider, defaults to the SDK's cached token; a token fetch failure returns null so a request is never broken.
- `AppCheckInterceptor` (`lib/core/network/api_client.dart`) — additive second interceptor alongside `AuthInterceptor`; attaches `X-Firebase-AppCheck` next to `Authorization` with no restructuring of the existing chain.
- Verification: `flutter analyze` clean, `flutter test` 185/185 pass, `flutter build apk --debug` succeeds.

**To flip to enforce later** (separate decision, NOT part of this round): register SHA-256 cert fingerprints in Firebase Console → App Check → Apps (Play Integrity) and set `APP_CHECK_ENFORCE=true`; watch monitor logs first for `app_check_missing` on `/auth/*` (debug builds need a debug token provider; sideloaded builds without Play services will log missing). The public invitation token routes (`GET/POST /invitations/:token*`) are reachable from browsers and may need a policy decision before enforcement.

**Realtime extension — DONE (R8, still monitor mode):** the same App Check coverage now reaches the Socket.IO handshake. The Flutter client sends its attestation as `auth.appCheckToken` next to `auth.token` (fetched via the same `AppCheckService` facade, null-safe like the HTTP header); `RealtimeGateway.verifyAppCheck` (`src/modules/realtime/gateways/realtime.gateway.ts`) verifies it with the same `FirebaseAdminService.getAppCheck().verifyToken()` and logs `realtime_app_check_pass` / `realtime_app_check_reject` / `realtime_app_check_missing`. It reuses the identical `appCheck.enforce` boolean from `APP_CHECK_ENFORCE` — when enforce is eventually flipped for HTTP, sockets are covered too, no second switch. Skipped (no log) when Firebase is not configured. Verification: backend `nest build` clean, `npm run lint` 0 errors, `npm test` 385/385, `test:integration` 46/46; Flutter `flutter analyze` clean, `flutter test` 223/223.

## 9. Performance Monitoring — Architecture (later round) — DONE (Round 3)
Flutter-side; custom traces around task-list load, SearchProvider's query round-trip, avatar upload.

**Flutter status — DONE** (firebase_performance 0.11.4):
- `PerformanceService` (`lib/shared/services/performance_service.dart`) — static `trace(name, action)` runs the action inside a named `FirebasePerformance.instance.newTrace` (start/stop with a `finally` stop so timings flush even on throw), or runs the action directly when not initialized (widget tests). Injectable `PerformanceMonitor` facade keeps providers unit-testable.
- Trace points: `task_list_load` (TaskProvider.loadTasks), `search_query` (SearchProvider.search), `avatar_upload` (AuthProvider.uploadAvatar). Trace names only — no task titles/query text as attributes.
- Verification: `flutter analyze` clean, `flutter test` 137/137 pass, `flutter build apk --debug` succeeds.

## 10. Analytics — Architecture — DONE (Round 5)
Must NOT duplicate activity_logs' audit purpose — aggregate product-usage signal only. Events: task_created, team_created, invitation_sent, invitation_accepted, comment_added, search_performed (result_count only, never raw query text), social_login_used (provider param). Never log task titles/comment bodies/search text as event params.

**Flutter status — DONE** (firebase_analytics 12.4.6):
- `AnalyticsService` (`lib/shared/services/analytics_service.dart`) — static event helpers (`taskCreated`, `teamCreated`, `invitationSent`, `invitationAccepted`, `commentAdded`, `searchPerformed`, `socialLoginUsed`) behind an injectable `AnalyticsTracker`, fired `unawaited` after the relevant mutation succeeds in each provider/screen; no-op when uninitialized (widget tests).
- Params strictly aggregate: task_created has has_team/has_category, search_performed has result_count only, social_login_used has provider only.
- Verification: `flutter analyze` clean, `flutter test` 181/181 pass, `flutter build apk --debug` succeeds (includes gating widget tests for the remote-config flags).

## 11. Environment & Secrets Management
FIREBASE_SERVICE_ACCOUNT_PATH (or base64 FIREBASE_SERVICE_ACCOUNT_JSON) + FIREBASE_PROJECT_ID follow the exact .env.example/gitignore convention already used for JWT_SECRET/DB_*. firebase_options.dart / google-services.json / GoogleService-Info.plist are gitignored per Round 0.

## 12. Cost & Rate-Limit Awareness
Firebase Auth (incl. social), FCM, Crashlytics, Remote Config, App Check (Play Integrity/DeviceCheck): free at any realistic scale for this project. Apple Developer Program ($99/yr) is a real, separate cost tied to the later Apple round, not Firebase itself.

## 13. Implementation Order & Dependencies
Round 0 (DONE): project setup, identifiers, inert Firebase init.
Round 1 (NOW): Google Social Login — the highest-value, self-contained item.
Round 1b (follow-up commit): Apple.
Round 1c: Facebook + the explicit link-confirmation flow (Decision 4) — DONE (app commits + backend commit).
Round 2: FCM — DONE (app commit + backend commit). Built in parallel with Round 1.
Round 3: Crashlytics + Performance Monitoring — DONE (app commit, no backend surface).
Round 4: App Links (independent of 1-3) — CODE-COMPLETE, ACTIVATION-PENDING (see §6: needs a real domain, Apple Team ID, release keystore fingerprint).
Round 5: Remote Config + Analytics — DONE (app-only commit).
Round 6: App Check — DONE (monitor mode; enforce is a separate future decision — see §8).

===== PART 2: DECISIONS ALREADY MADE — implement accordingly, do not re-open =====

1. Package/Bundle ID: com.tasko.app — DONE in Round 0.
2. Firebase projects: two — tasko-staging (local dev default) and tasko-production-14179 — DONE in Round 0.
3. Firebase Storage: NOT building it. Existing local/s3 drivers only. Do not add a firebase storage driver or FIREBASE_STORAGE_BUCKET config.
4. Facebook account-linking (applies to the LATER Facebook round, not Google today): does NOT auto-link by email the way Google/Apple do. If a Facebook sign-in's verified email matches an existing account, do not silently log the user into it — require an explicit confirmation step (password entry or confirmation email/link to the existing account) before linking. If not confirmed, do not create a duplicate account either — surface a clear "account already exists, here's how to link it" error/flow. This is real work, scoped to the Facebook round specifically, not Google.
