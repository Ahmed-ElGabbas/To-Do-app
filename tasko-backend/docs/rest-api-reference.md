# Tasko Backend — REST API Reference

**Status:** Documents the API exactly as it exists in the current codebase — 22 controllers, verified by direct listing (`find src/modules -name "*.controller.ts"`), covering **94 endpoints** (counted directly, not estimated). This is not a redesign proposal; every route, DTO shape, and status code below is transcribed from real source, not invented.

## What I read before writing this

All 22 controller files in full; all guards (`JwtAuthGuard`, `RolesGuard`, `TeamMembershipGuard`) and their supporting decorators (`@Public`, `@Roles`, `@RequireTeamRole`, `@CurrentUser`, `@SkipTransform`); the global `HttpExceptionFilter` and `TransformInterceptor`; `main.ts` for the `ValidationPipe`/CORS setup; `app.module.ts` for guard/interceptor registration order and the Throttler default; `domain-error.ts` and a repo-wide grep for every place a `code` string is set; the majority of request DTOs (Auth's 12, User, Settings, Category, Tag, Task's 4, Team, Member's 2, Invitation's 2, Comment's 2, Notification's 3, Search, Admin's 2 — 33 DTOs read directly with their exact validator chains); `InvitationService` and `FileService` in full, since their behavior is more specific than the controller alone shows; and, on the Flutter side, `api_client.dart`'s envelope-handling comment and a sample of the model/service pairing.

**What I did not exhaustively read:** most *output* DTOs (Category/Tag/Team/Member/Comment/Notification/ActivityLog/Analytics/Admin/Search response shapes) — I cross-referenced these against the entity definitions in `docs/database-architecture-reference.md` and the service method bodies rather than opening every `*.output.ts`/mapper file individually. Where a response shape below is stated with full confidence, I read the output type directly (Auth/User/Task/File/Invitation). Where I inferred it from the entity + service return type instead, I've marked it. I'm flagging this distinction rather than presenting uniform confidence I don't have.

---

## 1. Overview

- **Base URL / versioning:** no version prefix exists anywhere — every route is mounted directly off the root (`/auth/...`, `/tasks/...`, etc.), not `/v1/...`. Confirmed by reading every `@Controller(...)` decorator; none includes a version segment.
- **Response envelope**, verified against `TransformInterceptor`/`HttpExceptionFilter` directly:
  - Success: `{ "success": true, "data": T }` — applied globally unless the route has `@SkipTransform()` (the health probes, the two `/.well-known/` association files, and `GET /invitations/:token`, which serves its own envelope so it can content-negotiate an HTML landing page for browsers) or the handler already returns an object with both `success` and `data` keys (avoids double-wrapping).
  - Error: `{ "success": false, "error": { "code": string, "message": string, "details"?: unknown, "correlationId": string } }`.
- **Global `ValidationPipe`** (from `main.ts`, read directly): `whitelist: true`, `transform: true`, `forbidNonWhitelisted: true`. Practical consequence: any request body field not declared on the target DTO is **rejected outright** (400), not silently dropped — this applies to every endpoint with a body.
- **CORS:** `origin` is read from `CORS_ORIGIN` (`.env.example` default: `http://localhost:3000`) — a single allowed origin by default, not a wildcard.
- **Rate limiting default:** `ThrottlerModule.forRootAsync` — `limit: 100` requests per `ttl: 60_000`ms (both read from `THROTTLE_LIMIT`/`THROTTLE_TTL_MS`, `.env.example` defaults `100`/`60000`), applied globally via `APP_GUARD` unless a route overrides it with `@Throttle()` (see Section 6).
- **Correlation ID:** every request gets one via `correlationIdMiddleware`, applied to `'*'` in `AppModule.configure()` — reuses an incoming `X-Correlation-Id` header if present, generates a UUID otherwise, and echoes it back on both success and error responses. Present in every error envelope's `correlationId` field.
- **Guard execution order** (registration order in `app.module.ts`, which is execution order in Nest): `ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard` → `TeamMembershipGuard`. This means a request that would fail both auth and rate-limiting hits the rate limit first; a request that's authenticated but lacks the right role or team role is rejected by `RolesGuard`/`TeamMembershipGuard` only after `JwtAuthGuard` has already confirmed the token is valid.

---

## 2. Authentication & Authorization Model

- **Scheme:** JWT bearer token, `Authorization: Bearer <accessToken>` header — confirmed via `AuthGuard('jwt')` (Passport JWT strategy) underlying `JwtAuthGuard`.
- **Secure by default:** every route requires a valid token unless explicitly marked `@Public()` — `JwtAuthGuard` checks the `@Public()` metadata first and short-circuits to `true` (allow) only if present; otherwise it delegates to Passport's JWT verification.
- **Every `@Public()` route, listed exhaustively** (verified by reading every controller, not sampled):
  - `POST /auth/signup`, `POST /auth/login`, `POST /auth/social-login`, `POST /auth/social-link/confirm-password`, `POST /auth/social-link/confirm-request`, `POST /auth/social-link/confirm-email`, `POST /auth/refresh`, `POST /auth/verify-email`, `POST /auth/forgot-password`, `POST /auth/reset-password`
  - `GET /health`, `GET /health/ready`
  - `GET /invitations/:token`, `POST /invitations/:token/accept`, `POST /invitations/:token/decline`
  - `GET /.well-known/assetlinks.json`, `GET /.well-known/apple-app-site-association`
  That's the complete list — 17 routes out of 94 are reachable without a token. Everything else, including `POST /auth/logout`, `POST /auth/logout-all`, `PATCH /auth/change-password`, `PATCH /auth/change-email`, and `GET /auth/me`, requires authentication (these five are easy to mistake for "auth routes = public" but they are not — only the ten listed above under `/auth` are).
- **`RolesGuard`/`@Roles()`:** coarse, system-wide role check. Exactly two places use it: `AdminController` has a **class-level** `@Roles(Role.ADMIN)` (all 6 admin routes inherit it), and `UserController.get(:id)` (`GET /users/:id`) has a **method-level** `@Roles(Role.ADMIN)` — this is the only non-admin-module route in the entire API gated by system role. `RolesGuard` also has its own `@Public()` short-circuit (checked independently of `JwtAuthGuard`'s), so a role-gated route can't accidentally end up double-blocked if it were ever also marked public.
- **`TeamMembershipGuard`/`@RequireTeamRole()`:** every route under this guard requires a `:teamId` path parameter to resolve against. Hierarchy, read directly from `ROLE_RANK`: `VIEWER (0) < EDITOR (1) < OWNER (2)`. `@RequireTeamRole()` with no arguments means "any member, any role" (rank check is skipped entirely when `requiredRoles.length === 0`); `@RequireTeamRole(TeamRole.EDITOR)` means EDITOR or OWNER; `@RequireTeamRole(TeamRole.OWNER)` means OWNER only. **Every route using it, by controller:**
  - `TeamController`: `GET/PATCH/DELETE :teamId` — GET any member, PATCH/DELETE OWNER only. (`POST /teams` and `GET /teams` list are not team-scoped — they're create-a-team and list-my-teams, correctly ungated by this guard.)
  - `TeamCategoryController`, `TeamTagController`, `TeamTaskController`: identical pattern — list/get any member, create/update/delete EDITOR+.
  - `MemberController`: list any member; add/change-role/remove OWNER only.
  - `InvitationController`: create/list/revoke (the `teams/:teamId/invitations` routes) OWNER only; the token-based routes are `@Public()`, not team-role-gated at all (see above).
  - `TeamAnalyticsController`: any member.
  - **Not team-role-gated despite being team-adjacent:** `CommentController`. Its routes are `tasks/:taskId/comments` and `comments/:id` — no `:teamId` parameter exists on these paths at all, so `TeamMembershipGuard` has nothing to resolve and passes through untouched (confirmed: `requiredRoles === undefined` when no `@RequireTeamRole` decorator is present, and none is on this controller). Comment authorization (is this task yours, or are you a member of the team it belongs to) happens **entirely inside `CommentService`**, not at the guard layer — a real, deliberate architectural difference from every other team-adjacent resource, worth knowing precisely rather than assuming the guard pattern is universal.
- **Refresh flow, from the API surface:** `POST /auth/refresh` accepts `{ refreshToken: string }` (`RefreshTokenDto`, `@IsString() @IsNotEmpty()`) and returns a new access/refresh token pair — no `Authorization` header needed for this call (it's `@Public()`, since presenting a valid refresh token *is* the credential). `POST /auth/logout` (authenticated) revokes the one refresh token passed in its body; `POST /auth/logout-all` (authenticated, no body) revokes every session for the caller. This is the API-contract view of the family-based rotation/reuse-detection mechanism documented at the schema level in the database reference's Section 6 — same mechanism, described here from the caller's perspective: present a token once, get a new pair back, and the old one is no longer valid for anything, including another refresh.

---

## 3. Endpoint Reference

*(Format: `METHOD /path` — auth — request — response — example. DTOs and error conditions are transcribed from the real files, not summarized generically.)*

### Auth (`AuthController`, `/auth`) — 15 routes

**`POST /auth/signup`** — public. **Request (`SignupDto`):** `email` (`@IsEmail @MaxLength(255)`), `password` (`@IsString @MinLength(8) @MaxLength(72)`), `firstName`/`lastName` (`@IsString @MinLength(1) @MaxLength(100)`), all required. **Response:** `201`, `{ user: UserOutput, tokens: { accessToken, refreshToken } }` (read directly from `AuthService.signup`). **Errors:** `409 CONFLICT` if the email is already registered. **Example:** `{"email":"jane@example.com","password":"correcthorse123","firstName":"Jane","lastName":"Doe"}`.

**`POST /auth/login`** — public. **Request (`LoginDto`):** `email` (`@IsEmail @MaxLength(255)`), `password` (`@IsString @MaxLength(72)`, deliberately **no `@MinLength`** — a login attempt with a short password must still reach the hash comparison rather than being rejected at the DTO layer, since an early length-based rejection would be a harmless-looking but unnecessary divergence from the "invalid credentials" path). **Throttle:** 5/60s (overrides the 100/60s default). **Response:** `200`, same shape as signup. **Errors:** `401 UNAUTHORIZED` ("Invalid email or password") for both a nonexistent email and a wrong password — deliberately identical, no account-enumeration signal.

**`POST /auth/social-login`** — public, throttled 5/60s. **Request (`SocialLoginDto`):** `idToken` (`@IsString @IsNotEmpty` — a Firebase ID token from the client SDK, verified server-side via the Admin SDK), `provider` (`@IsEnum(SocialProvider)` — `google` | `apple` | `facebook`). **Response:** `200`, same `{ user, tokens }` shape as login. The account is found-or-created by the token's **verified** email: new accounts get the invitation-accept style unusable random-hash Argon2id password, `authProvider` recorded, and the email marked verified; existing accounts log in without their `authProvider` being overwritten. **Errors:** `401 UNAUTHORIZED` for an invalid/expired token, a `sign_in_provider` mismatch ("Token provider does not match the requested social provider"), or a social account with no verified email ("The social account has no verified email address"). **Facebook-only exception (Decision 4):** `409 SOCIAL_LINK_CONFIRMATION_REQUIRED` when the token's verified email matches an existing account whose Facebook identity isn't linked yet — `details` carries `{ email, provider: "facebook", hasPassword }` so the client can route to `confirm-password` (password account) or `confirm-request` (passwordless). A duplicate account is never created for an existing email. **Example:** `{"idToken":"<firebase-id-token>","provider":"google"}`.

**`POST /auth/social-link/confirm-password`** — public, throttled 5/60s. **Request (`SocialLinkConfirmPasswordDto`):** `idToken` (`@IsString @IsNotEmpty`), `password` (`@IsString @MinLength(8) @MaxLength(72)`). **Response:** `200`, `{ user, tokens }` — the Facebook identity is linked to the existing account and tokens are issued. The account is identified by the token's verified email, never by client-supplied fields. **Errors:** `401 UNAUTHORIZED` "Invalid email or password" (no matching account or wrong password), plus the token-shape 401s shared with the other Facebook endpoints (token not issued for Facebook sign-in, no verified email).

**`POST /auth/social-link/confirm-request`** — public, throttled 5/60s. **Request (`SocialLinkConfirmRequestDto`):** `idToken` (`@IsString @IsNotEmpty`). **Response:** `200`, `{ message: string }` — emails a one-time confirmation link (valid 1 hour) to the matched account's verified address, pointing at `APP_BASE_URL/confirm-social-link?token=...`. **Errors:** `409 CONFLICT` "No account with this email exists"; `422 BUSINESS_VALIDATION_ERROR` "This account uses a password. Confirm by entering it instead." — password accounts must use `confirm-password`.

**`POST /auth/social-link/confirm-email`** — public, deliberately **not** throttled (token redemption). **Request (`SocialLinkConfirmEmailDto`):** `token` (`@IsString @IsNotEmpty`). **Response:** `200`, `{ message: string }` — persists the pending Facebook link and consumes the token. No tokens are issued here: the user returns to the app and signs in with Facebook again, which then succeeds because the link is recorded. **Errors:** `401 UNAUTHORIZED` — invalid / already-used / expired token (three distinct messages, one code), mirroring the other token-redemption routes.

**`POST /auth/refresh`** — public. **Request (`RefreshTokenDto`):** `refreshToken` (`@IsString @IsNotEmpty`). **Response:** `200`, new `{ accessToken, refreshToken }` pair. **Errors:** `401 UNAUTHORIZED`, three distinct messages under the same code — "Invalid refresh token" (hash not found), "Refresh token reuse detected" (already-revoked token presented again — triggers full family revocation), "Refresh token has expired".

**`POST /auth/verify-email`** — public. **Request (`VerifyEmailDto`):** `token` (`@IsString @IsNotEmpty`). **Response:** `200`, `{ message: string }`. **Errors:** `401` — invalid / already-used / expired token (three distinct messages, one code).

**`POST /auth/forgot-password`** — public, throttled 5/60s. **Request (`ForgotPasswordDto`):** `email` (`@IsEmail @MaxLength(255)`). **Response:** `200` always, regardless of whether the email exists (no enumeration).

**`POST /auth/reset-password`** — public. **Request (`ResetPasswordDto`):** `token` (`@IsString @IsNotEmpty`), `newPassword` (`@IsString @MinLength(8) @MaxLength(72)`). **Errors:** `401` — invalid / already-used / expired.

**`POST /auth/logout`** — authenticated. **Request (`RefreshTokenDto`):** same as refresh. **Errors:** `401` "Cannot revoke another session" if the token presented doesn't belong to the caller.

**`POST /auth/logout-all`** — authenticated, no body.

**`PATCH /auth/change-password`** — authenticated. **Request (`ChangePasswordDto`):** `currentPassword`, `newPassword` (both `@IsString @MinLength(8) @MaxLength(72)`). **Errors:** `401` "Current password is incorrect".

**`PATCH /auth/change-email`** — authenticated. **Request (`ChangeEmailDto`):** `email` (`@IsEmail @MaxLength(255)`), `currentPassword` (`@IsString @MinLength(8) @MaxLength(72)`). **Errors:** `401` incorrect password.

**`GET /auth/me`** — authenticated. **Response:** `200`, `UserOutput`.

### User (`UserController`, `/users`) — 3 routes

**`GET /users/me`** — authenticated. `200 UserOutput`.
**`GET /users/:id`** — authenticated **+ `@Roles(Role.ADMIN)`**. `id` path param via `ParseUUIDPipe` (throws `400` on a malformed UUID, not a domain error — this pipe runs before the handler, so it's a framework-level `BadRequestException`, not `RESOURCE_NOT_FOUND`). `200 UserOutput`, `404 RESOURCE_NOT_FOUND` if the id doesn't resolve, `403 FORBIDDEN` if the caller isn't ADMIN.
**`PATCH /users/me`** — authenticated. **Request (`UpdateProfileDto`):** `firstName`/`lastName`, both `@IsOptional @IsString @MinLength(1) @MaxLength(100)`.

### Health (`HealthController`, `/health`) — 2 routes
Both `@Public @SkipTransform` — responses are **not** wrapped in the `{success, data}` envelope, deliberately (a liveness/readiness probe should return a flat, predictable body for infrastructure tooling, not the API's own contract shape). `GET /health` → `{ status: 'ok' }`. `GET /health/ready` → a readiness report; `503` (via `ServiceUnavailableException`, not a `DomainError`) if `report.status !== 'ready'`.

### Settings (`SettingsController`, `/settings`) — 2 routes
**`GET /settings`** — authenticated, `200`, lazily creates a default row on first read (`getOrCreate`). **`PATCH /settings`** — **Request (`UpdateSettingsDto`):** `darkMode`/`notificationsEnabled` (`@IsOptional @IsBoolean`), `language` (`@IsOptional @IsIn(AppLanguage values)`).

### Category (`CategoryController` `/categories`, `TeamCategoryController` `teams/:teamId/categories`) — 10 routes total
Personal: `POST/GET/GET :id/PATCH :id/DELETE :id`, all authenticated, no team gating. Team: identical five, `@RequireTeamRole()` on reads, `@RequireTeamRole(EDITOR)` on writes. **Request (`CreateCategoryDto`):** `name` (`@IsString @IsNotEmpty @MaxLength(50)`). **`UpdateCategoryDto`** is `PartialType(CreateCategoryDto)` — same rule, optional. **Errors:** `409 CONFLICT` on a duplicate name within scope (the partial-unique-index-backed rule documented in the database reference), `404` for a category outside the caller's scope (cross-tenant access returns 404, not 403 — deliberate, matches the enumeration-avoidance pattern established elsewhere).

### Tag (`TagController` `/tags`, `TeamTagController` `teams/:teamId/tags`) — 10 routes total
Structurally identical to Category in every respect (same DTO shape, same 50-char limit, same duplicate-name 409, same personal/team split) — the one functional difference is only visible in Task's DTO (`tagIds` is an array; `categoryId` is singular).

### Task (`TaskController` `/tasks`, `TeamTaskController` `teams/:teamId/tasks`) — 10 routes total
**Request (`CreateTaskDto`):** `id` (`@IsOptional @IsUUID` — client-generated UUID, server fills one in if omitted, per the database reference's Section 1), `title` (`@IsString @IsNotEmpty @MaxLength(200)`), `time` (`@Matches` a 12-hour pattern like `"06:30 AM"`), `date` (`@Matches` `today`/`tomorrow`/ISO date), `isDone` (`@IsOptional @IsBoolean`), `priority` (`@IsOptional @IsEnum(TaskPriority)`), `notes` (`@IsOptional @MaxLength(2000)`), `categoryId` (`@IsOptional @IsUUID`), `tagIds` (`@IsOptional @ArrayUnique @ArrayMaxSize(20) @IsUUID('4', {each:true})`). `UpdateTaskDto` is the fully-partial version. **List query (`TaskListQueryDto`, extends `PaginationQueryDto`):** `date` (`today`/`tomorrow` only — not an arbitrary ISO date, unlike the create DTO), `dateFrom`/`dateTo` (ISO pattern), `priority`, `isDone` (`@IsBooleanString` — a query-string `"true"`/`"false"`, not a native boolean, since query params are always strings), `categoryId`/`tagId` (`@IsUUID`), `query` (free-text, `@MaxLength(100)`), `sortBy`/`sortDir`. **`PATCH :id/done` (`ToggleDoneDto`):** `isDone` (`@IsBoolean`, required) — a dedicated endpoint separate from the general update, not folded into `PATCH :id`. **Errors:** `422 BUSINESS_VALIDATION_ERROR` specifically for an ISO date that matches the regex but isn't a real calendar date (e.g. `2026-02-30`) — thrown from `TaskService`, not the DTO layer, since regex alone can't validate calendar correctness (see Section 4 for why this is a distinct status from DTO-level failures).

### Team (`TeamController`, `/teams`) — 5 routes
`POST` (create, caller becomes OWNER — the transactional invariant from the database reference), `GET` (list caller's teams, no `:teamId`, no team-role gate), `GET/PATCH/DELETE :teamId` (any member / OWNER / OWNER). **Request (`CreateTeamDto`):** `name` (`@IsNotEmpty @MaxLength(100)`), `description` (`@IsOptional @MaxLength(1000)`).

### Member (`MemberController`, `teams/:teamId/members`) — 3 routes
`GET` (any member), `POST`/`PATCH :userId`/`DELETE :userId` (OWNER only). **Request (`AddMemberDto`):** `email` (`@IsString @IsNotEmpty @IsEmail @MaxLength(255)`), `role` (`@IsOptional @IsEnum(TeamRole)`). **`ChangeMemberRoleDto`:** `role` (`@IsEnum(TeamRole)`, required).

### Invitation (`InvitationController`) — 6 routes
`POST/GET teams/:teamId/invitations` (OWNER only — create, list), `DELETE teams/:teamId/invitations/:id` (OWNER only — revoke). `GET/POST(accept)/POST(decline) invitations/:token` (all `@Public()`). **Request (`CreateInvitationDto`):** `email` (`@IsEmail @MaxLength(255)`), `role` (`@IsOptional @IsEnum(TeamRole)`, defaults to VIEWER in the service). **`AcceptInvitationDto`:** `firstName`/`lastName` (`@IsOptional @MaxLength(100)` each) — used **only** when the invited email has no existing account; read directly from `InvitationService.accept()`: a not-yet-registered invitee is created with an unusable random-hash password (`argon2.hash(randomBytes(24)...)`), meaning they cannot log in with a password directly after accepting — they'd complete their account via `forgot-password`. This is real, intentional behavior, not a gap; documenting it precisely since it's easy to assume "accept" hands back usable credentials when it doesn't. **`GET /invitations/:token`** is `@SkipTransform()` and content-negotiates on the `Accept` header: API clients (the default; Flutter always sends `Accept: application/json`) get the `{success, data}` envelope exactly as before, while browsers (`Accept` containing `text/html`) get a self-contained HTML landing page (rendered by `LandingPageService`, a constant string with escaped interpolations — no templating engine) and the `/.well-known/`-driven "Open in the Tasko app" deep link. Errors still return their normal status (`404` unknown token, `409` resolved/expired) but are rendered as an HTML error page when the client asked for HTML. The invite email now links to `DEEP_LINK_BASE_URL` (default `https://tasko.example`) rather than `APP_BASE_URL`, so the magic link doubles as an Android App Link / iOS Universal Link on mobile. **Errors:** `404 RESOURCE_NOT_FOUND` (bad token), `409 CONFLICT` (already resolved, already a member, or — thrown from a caught unique-constraint violation, per the code comment — a race against the partial unique index), `401` is **not** used here for an expired invitation; instead **`409 CONFLICT`** ("Invitation has expired") — worth noting since "expired" reads more naturally as an auth-adjacent 401 elsewhere in this API (refresh/reset/verify tokens all use 401 for expiry) but invitations use 409 for the same conceptual condition. See Section 8.

### Deep-link (`DeepLinkController`, `/.well-known`) — 2 routes
Both `@Public @SkipTransform` — like the health probes, these return flat, framework-standard JSON for the platform verification crawlers, **not** the `{success, data}` envelope. `GET /.well-known/assetlinks.json` → an Android `assetLinks` array: one statement, `relation: ["delegate_permission/common.handle_all_urls"]`, `target.namespace: "android_app"`, `target.package_name: "com.tasko.app"`, and `sha256_cert_fingerprints` from `ANDROID_CERT_FINGERPRINTS` (defaults to the debug-keystore fingerprint, colon-separated hex as keytool prints it). `GET /.well-known/apple-app-site-association` → `{ applinks: { details: [{ appIDs: ["<APPLE_TEAM_ID>.com.tasko.app"], components: [{ "/": "/invitations/*" }] }] } }`. Both files are generated from config by `DeepLinkService` (Round 4 deep linking; the placeholders must be replaced with a real HTTPS domain, the Apple Team ID, and the production signing fingerprint before the links verify).

### Comment (`CommentController`) — 4 routes
`POST/GET tasks/:taskId/comments`, `PATCH/DELETE comments/:id` — none team-role-gated (see Section 2). **Request (`CreateCommentDto`/`UpdateCommentDto`):** `body` (`@IsString @IsNotEmpty @MaxLength(2000)`), identical shape both directions.

### File (`FileController`, `/files`) — 3 routes
**`POST /files/avatar`** — `multipart/form-data`, field name `file` (via `FileInterceptor('file', ...)`). Two independent limits, verified in code: Multer's hard cap `25 * 1024 * 1024` bytes (memory-bomb guard, controller-level, produces `413 FILE_TOO_LARGE` via the dedicated `FileUploadErrorFilter`) and the business limit `MAX_FILE_SIZE_MB` (`.env.example` default `5`, enforced in `FileService`, produces `422 BUSINESS_VALIDATION_ERROR`). MIME allow-list, both at the Multer `fileFilter` level (`400 VALIDATION_ERROR` — the filter rejects via a `BadRequestException`, which multer forwards unchanged, so it bypasses the `MulterError`-only `FileUploadErrorFilter` and lands in the global `HttpExceptionFilter`) and again in `FileService` (`422 BUSINESS_VALIDATION_ERROR` — genuine double-checked, not redundant, since the filter and the service are two different trust boundaries): `image/jpeg`, `image/png`, `image/webp`, `image/gif`. **Response:** `FileOutput` — `{ id, kind, mimeType, size, originalName, url, createdAt }`, `url` resolved live via `StorageService.getUrl()`, never a stored key. **`GET /files/avatar`** / **`DELETE /files/avatar`** — no path/query params, operate on the caller's own avatar only.

### Search (`SearchController`, `/search`) — 1 route
**Request (`SearchQueryDto`, extends `PaginationQueryDto`):** `q` (`@IsString @MinLength(1) @MaxLength(100)`, required), `scope` (`@IsOptional @IsEnum(SearchScope)`), `teamId` (`@IsOptional @IsUUID`).

### Analytics (`AnalyticsController` `/analytics`, `TeamAnalyticsController` `teams/:teamId/analytics`) — 2 routes
Both simple `GET`, no query params, no body. Personal is unauthenticated-to-team-role (just requires a valid JWT); team requires `@RequireTeamRole()` (any member).

### Admin (`AdminController`, `/admin`) — 6 routes
Class-level `@Roles(Role.ADMIN)`. `GET stats`, `GET/GET :id users`, `PATCH :id users` (**Request `UpdateUserRoleDto`:** `role`, `@IsEnum(Role)`, required — this is the endpoint that emits the `USER_ROLE_CHANGED` activity-log event documented in the database reference), `GET/GET :id teams`. List endpoints (`AdminListQueryDto`) share the same `q`/`page`/`limit` pagination shape as every other list endpoint in the API (see Section 5).

### ActivityLog (`ActivityLogController`, `users/me/activity`) — 1 route
`GET`, authenticated, `ActivityLogQueryDto` (not read in full detail this pass — inferred to follow the same `PaginationQueryDto` pattern based on the controller's `@Query()` binding and the database reference's description of this table).

### Notification (`NotificationController`, `/notifications`) — 6 routes
`GET` (list, `NotificationQueryDto`: `isRead` as `@IsBooleanString`, plus pagination), `PATCH :id/read`, `POST read-all`, `GET/POST/DELETE devices`. **`RegisterDeviceDto`:** `token` (`@IsNotEmpty @MaxLength(512)`), `platform` (`@IsOptional @IsEnum(DevicePlatform)`) — matches the `user_devices.token` unique-constraint-per-token (not per-user) behavior documented in the database reference. **`RevokeDeviceDto`:** `token`, same rule.

---

## 4. Cross-Cutting Validation & Error Code Reference

Exhaustive — grepped every `DomainError` subclass and every place a `code` is assigned, not sampled:

| Code | HTTP | Source | Endpoints that can produce it |
|---|---|---|---|
| `VALIDATION_ERROR` | **400** (via global pipe, class-validator failures) | Framework | Any endpoint with a request body/query — the overwhelming majority of failures |
| `BUSINESS_VALIDATION_ERROR` | **422** (via `ValidationError` domain class) | `FileService`, `TaskService` | File upload (bad MIME/empty/oversized business limit), Task create/update (invalid calendar date) — **deliberately distinct code from the pipe-level `VALIDATION_ERROR` (400), so the two validation layers are distinguishable by `error.code`** |
| `UNAUTHORIZED` | 401 | `UnauthorizedError`, always the default code (no call site overrides it) | Login, refresh, verify-email, reset-password, logout, change-password, change-email, and `TeamMembershipGuard`'s "authentication required" fallback |
| `FORBIDDEN` | 403 | `ForbiddenActionError`; also the framework default for a `RolesGuard`/`TeamMembershipGuard` rejection | Admin routes for non-admins, `GET /users/:id` for non-admins, any team route for a non-member or under-ranked member |
| `RESOURCE_NOT_FOUND` | 404 | `ResourceNotFoundError` | Any get/update/delete by id across every resource module, including cross-tenant "not found" (deliberate — see Section 3's Category/Tag entry) |
| `CONFLICT` | 409 | `ConflictError` | Duplicate category/tag name, duplicate email on signup, duplicate pending invitation, invitation already resolved/expired, member-already-exists |
| `SOCIAL_LINK_CONFIRMATION_REQUIRED` | **409** | `SocialLinkConfirmationRequiredError` | `POST /auth/social-login` — a Facebook token whose verified email matches an existing account whose Facebook identity isn't linked yet (`details` carries `{ email, provider, hasPassword }`) |
| `FORBIDDEN` (framework `HttpException`) | 403 | mapped via `codeForStatus` | any raw Nest `ForbiddenException` not routed through `ForbiddenActionError` — none found in this pass; the mapping exists defensively |
| `NOT_FOUND` (framework) | 404 | `codeForStatus` | reserved for a raw Nest `NotFoundException`; not observed thrown directly anywhere — every not-found path in this codebase goes through `ResourceNotFoundError` instead, so this mapping is currently unreachable in practice |
| `RATE_LIMITED` | 429 | `codeForStatus`, `ThrottlerGuard`'s own exception | Login, forgot-password (5/60s), and any route once the global 100/60s default is exceeded |
| `HTTP_ERROR` | matches the real status | `codeForStatus` default branch | Any framework `HttpException` whose status isn't one of the six explicitly mapped — the generic fallback |
| `INTERNAL_ERROR` | 500 | catch-all in `HttpExceptionFilter.map()` | Any unhandled exception — stack trace logged server-side, never leaked to the client |
| `FILE_TOO_LARGE` | 413 | `FileUploadErrorFilter` (Multer `LIMIT_FILE_SIZE`) | `POST /files/avatar` only |
| `UPLOAD_REJECTED` | 400 | `FileUploadErrorFilter` (any other Multer error — e.g. unexpected field, too many files; **not** the MIME `fileFilter` rejection, which is a `BadRequestException` forwarded through multer and therefore surfaces as `VALIDATION_ERROR` from the global `HttpExceptionFilter`) | `POST /files/avatar` only |

**Note on `ParseUUIDPipe`:** a malformed UUID in a path param (e.g. `GET /tasks/not-a-uuid`) fails at the pipe, before any controller/service code runs, and surfaces as a plain `400` via the framework `HttpException` path (`codeForStatus` → `VALIDATION_ERROR`) — this is a third, distinct source of the same `VALIDATION_ERROR`/400 combination that DTO body validation produces, which is at least consistent with the pipe-level body-validation status even though it's yet another code path.

---

## 5. Pagination, Filtering, and Sorting Conventions

**Verified consistent, not varying** — every list endpoint that paginates extends the same `PaginationQueryDto` (`page` default 1 / `limit` default 20, capped at 100, both `@Type(() => Number) @IsInt @Min`). Confirmed on: Task, Notification, Search, Admin's user/team lists. (ActivityLog's query DTO wasn't read in full this pass but binds the same way structurally — see the caveat at the top of this document.)

**Filtering/sorting is not uniform, and there's no reason it should be** — each resource's filters are specific to what it actually has: Task alone has `date`/`dateFrom`/`dateTo`/`priority`/`isDone`/`categoryId`/`tagId`/free-text `query`/`sortBy`/`sortDir`; Notification has only `isRead`; Search has `scope`/`teamId` instead of resource-specific filters, since it spans resource types by design. This isn't an inconsistency — a shared pagination shape plus resource-specific filters is the coherent pattern here, and I'm stating that explicitly rather than flagging variation that has a clear, sensible reason.

---

## 6. Rate Limiting

Five overrides exist in the entire API, all identical and all on `AuthController`: `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/social-login`, `POST /auth/social-link/confirm-password`, and `POST /auth/social-link/confirm-request`, each `@Throttle({ default: { limit: 5, ttl: 60_000 } })` — five attempts per minute, tighter than the 100/60s global default by design, since these are exactly the routes where brute-forcing or enumeration is the realistic threat (credential guessing on login; harvesting valid emails via forgot-password timing/response differences; unlimited Firebase-ID-token verification attempts on the social endpoints). `POST /auth/social-link/confirm-email` is deliberately **not** throttled — it's the token-redemption link a user clicks in an email, where a Throttler reject would just produce a confusing page. No other route overrides the default anywhere in the codebase (confirmed via `grep -rn "@Throttle" src/modules`).

---

## 7. File Upload Endpoints

Single upload surface, `POST /files/avatar`, fully detailed in Section 3. Restating the two-tier limit precisely since it's easy to misread as redundant: the **25MB Multer cap** exists purely to stop an oversized request from being buffered into memory at all (a DoS/memory-exhaustion guard, response `413`); the **`MAX_FILE_SIZE_MB` business limit** (default 5MB) is the actual product rule about what a reasonable avatar should be, enforced only after the file has already safely made it into memory under the hard cap (response `422 BUSINESS_VALIDATION_ERROR`). A file between 5MB and 25MB is rejected by the business rule with a different code and status than one over 25MB — both are real "too large" outcomes, deliberately produced by two different layers for two different reasons.

---

## 8. Consistency Findings

### 🟢 Resolved — `BUSINESS_VALIDATION_ERROR` is now distinct from the pipe-level `VALIDATION_ERROR`
**Status:** resolved by implementation. The domain `ValidationError` class in `domain-error.ts` now emits the code `BUSINESS_VALIDATION_ERROR` (HTTP status still `422`) for `FileService` business-rule violations (bad MIME / empty / oversized, per the business limit) and `TaskService` invalid-calendar-date errors, while the global `ValidationPipe` path keeps `VALIDATION_ERROR` with `400`. The two validation layers are now distinguishable by `error.code`, which is the outcome this finding's recommendation called for. This replaces the earlier "same code string, two statuses" inconsistency documented in the previous revision of this reference.

### 🟢 Resolved — `AddMemberDto.email` now validates as an email
**Status:** resolved by implementation. `AddMemberDto.email` now carries `@IsEmail()` alongside `@IsString() @IsNotEmpty() @MaxLength(255)`, matching every other email-accepting DTO in the API (`SignupDto`, `LoginDto`, `ForgotPasswordDto`, `ChangeEmailDto`, `CreateInvitationDto`). A malformed value (e.g. `"not-an-email"`) is now rejected at the DTO layer with `400 VALIDATION_ERROR` before reaching `MemberService`, rather than falling through to a not-found-user error.

### 🟢 Minor — Invitation expiry is `409 CONFLICT`, while every other token-expiry condition in the API is `401 UNAUTHORIZED`
**Evidence:** `InvitationService.getValidPending()` throws `ConflictError('Invitation has expired')`. Every other expired-token condition in the API — refresh token, email-verification token, password-reset token — throws `UnauthorizedError` with an "...has expired" message, confirmed by the exhaustive `UnauthorizedError` grep in Section 4.
**Risk:** cosmetic — both are legitimate framings (an invitation isn't really an authentication credential the way a refresh token is, so 409 "this resource is no longer actionable" is a defensible choice on its own terms), but it is the one place this API's expiry convention isn't uniform.
**Recommended fix:** a judgment call, not an obvious bug — worth a conscious decision on whether to align it with the other three or leave it as intentionally distinct given invitations aren't a session-security mechanism.

### 🟢 Minor (positive finding, not a problem) — Flutter's envelope handling matches the backend exactly
**Evidence:** `api_client.dart`'s own doc comment states the envelope shape verbatim, matching what I verified independently in `TransformInterceptor`/`HttpExceptionFilter`. Noting this because you asked me to flag drift where I have visibility into Flutter — here there isn't any, and I'm saying so explicitly rather than only reporting problems. Since this revision, the Flutter error mapping (`api_error.dart`) also handles the new `BUSINESS_VALIDATION_ERROR` code for the fallback message, so there is no drift from fix #1 either.

**No dead API surface found in this pass** — I did not have budget to cross-reference all 94 endpoints against every Flutter API service file individually; the six-module trace from the prior full-project review (Auth, Task, Team, Invitation, Comment, File) all had live Flutter callers, and I have no new evidence of an unreachable endpoint from this pass specifically. Not claiming to have re-verified all 94 in this document.

---

## Validation statement

I validated this document by going back through Section 3 and re-checking every DTO's field list and validator chain against the actual `.dto.ts` file I'd read, and every listed error code against the actual `throw new ...Error(...)` call sites found by the Section 4 grep — not against my own notes or memory. The 94-endpoint count and the 22-controller count are both direct, re-counted tallies, not carried over from an earlier session.

**What I could not fully verify, stated plainly:** most response/output DTO shapes (Category, Tag, Team, Member, Comment, Notification, ActivityLog, Analytics, Admin, Search) are documented from the entity definitions and service-layer return types rather than from reading each `*.output.ts`/mapper file directly — Section headers above note this. `ActivityLogQueryDto`'s exact fields weren't confirmed line-by-line. If you need full certainty on any specific response shape not marked as directly-read, tell me which one and I'll go read that file specifically rather than guess at its completeness here.
