# Tasko — Real-Time Architecture Plan (Socket.IO)

**Status:** Planning document with R0–R7 shipped. **R0 is implemented and verified** (build, lint, 340 unit / 37 integration / 44 e2e tests, plus a live `socket.io-client` smoke test): the Socket.IO dependency stack, `RealtimeModule` + `RealtimeGateway` with JWT handshake auth and `user:<id>` auto-join, the Redis IO adapter gated on `REDIS_URL`, and the `REALTIME_*` config vars. **R1 is implemented** (build, lint, 347 unit tests; unit suite only, per its checkpoint): `MemberRepository.listByUser` (+ TypeORM impl), server-side `team:<id>` auto-join on connect, the `MEMBER_REMOVED` domain event emitted by `MemberService.removeMember`, and the `RealtimeEventConsumer` that force-leaves removed sockets and broadcasts `member.removed` to the team room. **R2 is implemented** (build, lint, 357 unit tests — full existing suite green, proving the additive contract broke nothing): `teamId?: string` populated at all four emitter sites, and the consumer's Section 3.3 router for `task.*`, `comment.added` and `invitation.accepted` with the `TASK_ASSIGNED`/`USER_ROLE_CHANGED` skip rules. **R3 is implemented** (build, lint, 366 unit / 37 integration tests — the integration suite validates the new `NotificationModule → RealtimeModule` dependency boots): in-memory `PresenceRegistry`, `user.online`/`user.offline` broadcasts to team rooms, and the Section 2.4 FCM suppression hook (notification row always written, push skipped for online recipients). **R4 is implemented** (build, lint, 376 unit / 37 integration tests): the Section 6.1 `typing` relay (rate-limited per-packet middleware; server resolves task → `teamId` via `TaskRepository`, verifies room membership, stamps `userId`) and the Section 11.1 fixed-window per-user `RealtimeRateLimiter` (`REALTIME_EVENT_RATE_LIMIT`/`REALTIME_EVENT_RATE_TTL_MS`, `RATE_LIMITED` error code mirroring the REST 429 path). **R5 is implemented** (build, lint, 376 unit / 46 integration tests — 9 new realtime scenarios): `test/integration/realtime.integration-spec.ts` exercises the full wire protocol against a live `socket.io-client` on an ephemeral port — presence `user.online`/`user.offline`, the `task.created` relay with a `TaskOutput` payload, the non-member leak check, member force-leave + `member.removed`, FCM suppression while online and push dispatch once offline, handshake auth rejects (`UNAUTHORIZED`/`AUTH_TOKEN_MISSING`), the per-user rate limiter (`RATE_LIMITED`), and the `typing` relay. Sections below keep their original status labels where their content is not yet built (R7+). **R6 is implemented** (`flutter analyze` zero issues; Flutter suite 185 → 199 tests, 14 new): the Flutter `RealtimeService` (`lib/shared/services/realtime_service.dart`) with an injectable `RealtimeConnection`/`SocketIoConnection` facade over `socket_io_client` 3.1.6 (websocket-only transport, `autoConnect` disabled, JWT `auth` payload), a Section 3.4 envelope parser routing to typed coarse handlers, single-refresh handshake recovery reusing `ApiClient.refreshAccessToken` with an `onSessionExpired` fallback (refresh never retried per failure), an `onReconnected` hook that re-fetches state over REST (Section 8), and `sendTyping`; `main.dart` owns the singleton instance and wires session-expired logout + reconnect re-fetch, `AuthProvider` connects on login/restore and disconnects on logout, and the splash screen re-connects post-restore. **R7 is implemented** (`flutter analyze` zero issues; Flutter suite 199 → 221 tests, 22 new; debug APK builds): `TaskProvider.applyRealtimeEvent` (task upsert/delete routing with malformed-payload guards), `CommentProvider.applyRealtimeComment` (task-scoped, deduped, insertion-sorted by `createdAt`), `TeamProvider` presence map (`applyPresence`, `isOnline`, notify-only-on-change), the `main.dart` central dispatcher (`onTaskEvent`/`onPresence`/`onMemberRemoved`/`onInvitationAccepted` + `subscribeComment`/`subscribeTyping`/`subscribeMemberRemoved` screen-scoped registries on `RealtimeService`), `CommentsScreen` live comments + "someone is typing" indicator (4 s auto-expire, self-exclusion, `sendTyping` true-on-first-keystroke / false-after-3-s idle), `TeamDetailsScreen` presence dots (a11y label) + `member.removed` roster reload, l10n keys (en/ar/fr), and provider/widget tests (`test/team_provider_test.dart` presence group, `test/realtime_screens_test.dart`). Decisions 1, 3, 4, 7 were confirmed by the project owner and are now closed — see Section 14. No implementation code existed before R0; the plan remains the source of truth for everything not yet shipped.

**Package-version facts verified via web search on 2026-08-14**, not assumed — see Section 1.

---

## 0. Grounding: what I verified before writing anything

- **The event bus is a clean insertion point.** `TaskEventBus` (`src/infrastructure/events/task-event-bus.service.ts`) keeps a `Set<TaskEventConsumer>`; `NotificationService` and `ActivityLogService` self-register via `OnModuleInit` + `eventBus.register(this)`. Adding a realtime consumer is exactly the ADR-0007 "one self-registering class plus one module import" pattern — no bus or registry edits. Architecturally straightforward, confirmed by reading the bus, the consumer interface (`task-event.consumer.ts`), and both existing consumers directly.
- **The `TaskEvent` contract has no `teamId`.** This is the one finding that affects the plan's shape, so it is stated up front and detailed in Section 3/4: `TaskEvent` = `{ id, type, userId, taskId?, occurredAt, data }`. Every emitting site has the team id in hand at publish time (`TaskScope.teamId`, the task entity, `invitation.teamId`) but none of them write it. Without it, a realtime consumer cannot route a single event to a `team:<id>` room — and for `TASK_DELETED` it *cannot* recover the team id afterward (the row is deleted before the event is published; `task.service.ts:206-209`). The plan therefore includes a small, additive, backward-compatible `teamId?: string` field on `TaskEvent`.
- **`MemberRepository` has no `listByUser`.** It exposes `findByTeamAndUser`, `listByTeam`, and friends, but nothing that answers "which teams is this user in?" That query is needed both to auto-join a connecting client's rooms and to know which rooms a presence broadcast must target. The plan adds one additive method to the interface + TypeORM implementation.
- **The `USER_ROLE_CHANGED` precedent.** That event is deliberately *not* in `NotificationType` (audit-only, per the database reference Section 5). The realtime layer treats it the same way: not broadcast. Noted in Section 3.

---

## 1. Overview & Technology Choice

### 1.1 Library stack — verified current and compatible

| Package | Version | Notes |
|---|---|---|
| `@nestjs/websockets` | 11.1.x (latest 11.1.26) | The current, maintained NestJS package for gateways; correct for NestJS 11 (this repo is on `@nestjs/common ^11.0.1`). |
| `@nestjs/platform-socket.io` | 11.1.x (latest 11.1.29) | The Socket.IO adapter for NestJS 11; brings `socket.io` server v4 transitively. |
| `socket.io` (server) | 4.8.3 | Current stable 4.x line. |
| `socket_io_client` (Flutter/Dart) | 3.1.6 | Active, published ~2 months ago. Its compatibility matrix requires **v3.x for Socket.IO server 4.7+** — server 4.8.3 and client 3.x are a matched pair. Do **not** use the 2.x line (that caps at server 4.6). |
| `@socket.io/redis-adapter` | 8.x (8.2.1+) | Compatible with Socket.IO 4.3.1+. Uses **ioredis**, which is already a direct dependency (`ioredis ^5.11.1`) — no new Redis client library needed. |
| `socket.io-client` (JS, for backend tests) | 4.8.3 | Same protocol version as the server; used only in integration specs. |

This is the same choice the Firebase plan made for its dependencies: `socket.io` is the de-facto standard for Flutter + NestJS real-time, `socket_io_client` is the only actively maintained Dart client that tracks the Socket.IO protocol, and the NestJS gateway layer (`@nestjs/websockets` + `@nestjs/platform-socket.io`) is the current, recommended way to host it in a Nest app (NestJS docs: "Gateways can be treated as providers", Socket.IO and `ws` are the two supported out-of-the-box platforms). **Confirmed: this stack is correct and current.**

### 1.2 Integration: one NestJS app, one HTTP server, one namespace

**Recommendation: a NestJS `@WebSocketGateway()` hosted by the existing NestJS app, attached to the same HTTP server and port as the REST API, on the default namespace.**

- The gateway attaches to the same `http.Server` Nest already binds in `main.ts` (this is the default `IoAdapter` behavior). The Flutter client connects to the same base URL the REST client already uses — no second port, no extra CORS/SSL/proxy surface, no TLS-termination duplication, and deployment topology stays identical to today.
- A separate standalone Socket.IO server (own port or process) is a real option but buys nothing at this project's scale and costs: separate health/readiness wiring, separate CORS config, an extra process to deploy and monitor. Not recommended.
- A dedicated namespace (e.g. `/realtime`) is *optional* and adds no functional value when the default namespace is already effectively "the authenticated app." Recommend the default namespace and keep room partitioning (Section 4) as the only addressing mechanism. This is consistent with the REST API's own stance of "no version prefix, mount everything off the root" (rest-api-reference Section 1).

### 1.3 Redis adapter (`@socket.io/redis-adapter`): build in day one, gated on `REDIS_URL`

The project already gates queue/cache infrastructure on `REDIS_URL` (`QueueService.isEnabled()`, `TaskEventsModule.forRoot()`). The Redis IO adapter is the correctness-critical piece, not a nice-to-have:

- **Without it, room broadcasts are silently broken the moment there is more than one backend instance**: a `server.to('team:<id>').emit()` on instance A never reaches a client connected to instance B, and nothing fails loudly. That is a latent correctness bug, not a scaling concern.
- **With it, the cost is ~20 lines**: an `IoAdapter` subclass whose `createIOServer()` calls `server.adapter(createAdapter(pubClient, subClient))` using two ioredis clients derived from `REDIS_URL`, wired in `main.ts` via `app.useWebSocketAdapter()` only when `REDIS_URL` is set — exactly the existing "Redis present = enabled, absent = in-process/dev" convention. Local dev and the test suite run without Redis, matching how BullMQ and the event bus already behave.

**Decision: wire the Redis IO adapter from day one (R0), gated on `REDIS_URL`. Defer as a documented scaling gap** (not built in R0): cross-instance *presence state* and cross-instance *FCM suppression* — both are in-memory per instance initially, with a concrete migration path noted in Section 5/2. The failure mode of the deferred parts is graceful (incomplete presence roster, an occasional redundant push), while the adapter's failure mode would be silent event loss — which is why the adapter is the part that is not deferred.

---

## 2. Authentication & Connection Lifecycle

### 2.1 Handshake — same JWT, same verification, one new access path

- The Flutter client sends the existing JWT access token in the Socket.IO connection `auth` payload: `IO.io(baseUrl, OptionBuilder().setTransports(['websocket']).setAuth({'token': accessToken}).build())`.
- Server-side, the gateway's `handleConnection` (or the `connection` middleware) reads `client.handshake.auth.token` and verifies it with the **same `JwtService` + same `jwt.secret` + same payload contract** the HTTP `JwtStrategy` uses (`{ sub, email, role }` → `{ id, email, role }`). This is *reuse of the existing verification*, not a second JWT implementation: the strategy's only real logic is "decode with this secret, build `AuthenticatedUser`", which is exactly what the handshake re-applies for a non-HTTP transport. The result is attached as `client.data.user = { id, email, role }` for the socket's lifetime.
- Invalid/expired/missing token → `client.emit('auth_error', { code: 'UNAUTHORIZED', message: ... })` then `client.disconnect(true)`. The wire error shape uses the same `{ code, message }` fields as the REST error envelope (without the HTTP status/correlationId — correlation ids are an HTTP-request concept and don't map to a socket; see Section 3.4).
- The HTTP `JwtAuthGuard` is an `APP_GUARD` and does not apply to gateways; the gateway performs the equivalent check itself at handshake. This is the one place the plan re-implements a *guard's entry point* — but it reuses its underlying verification wholesale, which is what the "reuse, don't reimplement" rule requires.

### 2.2 Token expiry mid-connection

**Recommendation: verify at handshake only; do NOT proactively disconnect on JWT expiry mid-connection.**

- The access token is a *connection credential*, not a per-message credential. Once the transport is authenticated, re-verifying on expiry adds no security for an already-established connection and would create a 15-minute (default `JWT_ACCESS_TTL=900s`) disconnect/reconnect churn on a socket that is often idle (the app is backgrounded on mobile).
- The existing refresh-token rotation (ADR-0003) already handles long-lived sessions at the app layer: the Flutter `AuthInterceptor` refreshes on 401 and rotates the refresh token; the socket simply uses the *current* access token at its next handshake (reconnect), which happens naturally after backgrounding or network drops.
- Server-side reactive behavior to *session revocation* (e.g. `logout-all`) is a separate, deliberate item: the plan flags it as an optional R8 enhancement (revoke a user's sockets when their refresh-token family is revoked), not part of the core flow.
- **Flagged alternative (your call):** the gateway *could* schedule a disconnect at the token's `exp` (`client.disconnect(true)` on a timer). It's cheap to add. I recommend against it for the churn reasons above, but it's a one-line behavioral switch if you prefer strict expiry semantics on live sockets.

### 2.3 Reconnection behavior

- `socket_io_client` reconnects automatically with backoff (default). On every reconnect, the handshake re-runs with the current access token — so the client must supply a fresh token on each connect attempt. The client's `connect()` path reads the token from `TokenStore` (same store the HTTP layer uses), so a post-refresh reconnect automatically carries the rotated token.
- **Handshake rejection = session death signal.** If reconnect fails with `auth_error` (revoked session, logged out elsewhere), the client goes through the same flow `onSessionExpired` already triggers in `main.dart` (`tokenStore.clear()` → login screen). This mirrors how the HTTP layer treats a hard 401 after refresh.
- **Foreground/background consistency with Round 2:** FCM (Round 2) already distinguishes foreground (in-app feed refresh, no system alert) vs background/terminated (system notification + deep link). Socket.IO lives on the *foreground* side of that same model: while the app is foregrounded and connected, live events replace the need for a push; when the app is backgrounded/closed, the socket drops (mobile OS suspends it), FCM takes over, and on foreground the socket reconnects and the existing `loadTasks()`/`load()` refresh path runs. The two are complementary by lifecycle, not competing — Section 2.4 formalizes the handoff.

### 2.4 The Socket.IO ⇄ FCM handoff rule

- **When a user has ≥1 authenticated socket connected, the FCM push for the same event is suppressed.** Rationale (matches the plan's stated goal): the user just saw it live; a push would be redundant.
- Implementation point: `NotificationService.handle()` (`notification.service.ts:99-110`) is where both the notification row and the push dispatch happen. The notification **row is still written** (the inbox is the persistent record; it must not depend on connection state). Only the `pushDispatcher.dispatch(...)` call is skipped when `presenceRegistry.isUserOnline(event.userId)` returns true.
- The presence registry is in-memory per instance in this round (Section 5). **Documented failure mode of the deferred Redis presence:** with 2+ instances, a user connected to instance B may not appear "online" to a handler running on instance A → a redundant push fires alongside the live event. Redundant, never missing — the suppression is a UX optimization, not a delivery guarantee.
- Socket.IO does not replace FCM for anything else: no new push path, no APNs/FCM changes, `PushDispatcher` and the `user_devices` flow are untouched.

---

## 3. Events

### 3.1 The one contract change this layer requires

`TaskEvent` gains an optional `teamId?: string` (`src/infrastructure/events/task-event.ts`), populated by the emitters that have it in scope. ✅ **SHIPPED (R2, 2026-08-15):** the field and all four emitter-site updates below are in `task.service.ts`/`comment.service.ts`/`invitation.service.ts`, verified by the full existing test suite still passing (the additive contract broke nothing). `admin.service.updateRole` correctly leaves it unset (system-level, no team).

| Emitter | Site | Value |
|---|---|---|
| `task.service.ts` `emit()` | lines 212-226 | `scope.teamId ?? undefined` |
| `task.service.ts` `emitAssigned()` | lines 232-244 | the `teamId` parameter |
| `comment.service.ts` `create()` | lines 59-71 | `task.teamId ?? undefined` |
| `invitation.service.ts` `accept()` | lines 160-166 | `invitation.teamId` |
| `admin.service.ts` `updateRole()` | lines 83-94 | none (system-level, no team) |

This is strictly additive: every existing consumer (`NotificationService`, `ActivityLogService`) ignores the new field, so their behavior is unchanged, and no migration is needed (it's a wire/DTO contract, not a column). It is the only viable routing key for `TASK_DELETED` in particular, because the row is gone by the time the event is consumed (Section 0).

### 3.2 One new domain event (genuinely new, small)

**`MEMBER_REMOVED` (`member.removed`)** emitted by `MemberService.removeMember()`. ✅ **SHIPPED (R1, 2026-08-15):** enum value + `teamId`-scoped event published by `removeMember`, consumed by `RealtimeEventConsumer` (force-leave + team-room broadcast). This is the only event the existing system did not already produce that this layer truly needs: when an OWNER removes a user from a team, the removed user's connected sockets must be dropped from `team:<id>` and the remaining members' rosters refreshed. Without it, a removed member keeps receiving team events until they reconnect — a real information-leak window. The enum is open (`activity_logs.type` is a plain varchar, the notification template switch's `default` already returns null), so adding a value is safe and requires no schema change. It intentionally produces **no notification** (consistent with the `USER_ROLE_CHANGED` precedent) — only the realtime broadcast + force-leave.

*Optional, not in scope for v1:* `MEMBER_ADDED` (so online members see roster changes live). Flagged as a v2 nicety; v1 covers it by the existing REST re-fetch path.

### 3.3 Server → Client events (complete table)

Every event below is emitted **to a room** (`team:<id>` or `user:<id>`), never to a single socket (the actor's own socket is in the room too; clients treat their own mutation echoes as idempotent no-ops — Section 7).

| Wire event | Domain source (`TaskEventType`) | Target room | Payload shape |
|---|---|---|---|
| `task.created` | `TASK_CREATED` | `team:<teamId>` if team-scoped, else `user:<userId>` | `task: TaskOutput` (full, per `task.output.ts`) |
| `task.updated` | `TASK_UPDATED` | same as above | `task: TaskOutput` |
| `task.completed` | `TASK_COMPLETED` | same | `task: TaskOutput` |
| `task.reopened` | `TASK_REOPENED` | same | `task: TaskOutput` |
| `task.deleted` | `TASK_DELETED` | same | `{ taskId, title, teamId }` (the row is gone; no `TaskOutput` is reconstructible — deliberate) |
| `comment.added` | `COMMENT_ADDED` | `team:<task.teamId>` if team-scoped, else `user:<task.userId>` | `{ comment: CommentOutput, task: { id, title } }` (`CommentOutput` per `comment.output.ts`) |
| `invitation.accepted` | `INVITATION_ACCEPTED` | `team:<invitation.teamId>` | `{ teamId, invitedEmail, invitedBy: { userId } }` |
| `member.removed` | `MEMBER_REMOVED` (new) | `team:<teamId>` (remaining members) | `{ teamId, userId }` |
| `user.online` | **new** (presence, Section 5) | every `team:<id>` the user belongs to | `{ userId }` |
| `user.offline` | **new** (presence) | every `team:<id>` the user belongs to | `{ userId }` |
| `typing` | **new** (collaboration, Section 6) | `team:<task's teamId>` (client filters by `taskId`) | `{ taskId, userId, isTyping }` |

**Deliberately not mapped:**

- **`TASK_ASSIGNED`** → not emitted as a realtime event. It exists to notify *persistence* consumers per-recipient; for realtime, `TASK_CREATED` broadcast to the team room already reaches every member, including other recipients. Emitting both would duplicate `task.created` on the wire. The realtime consumer therefore **skips** `TASK_ASSIGNED` (its notification/activity consumers are untouched).
- **`USER_ROLE_CHANGED`** → not broadcast. It is an audit concern with no live UI, mirroring its exclusion from `NotificationType`.
- **`COMMENT_ADDED` for the task owner** → covered: if the task is personal, the owner is `user:<id>`; if team-scoped, the owner is in `team:<id>` (owner is always a member). No special case needed beyond the room rule above.

### 3.4 Payload envelope

Socket events do **not** use the HTTP `{ success, data }` envelope (that is `TransformInterceptor`'s HTTP contract). To stay consistent with the API's *shaping* conventions (camelCase, whitelisted output DTOs) while giving clients what sockets actually need, every server→client event carries:

```
{
  "eventId": string,     // the TaskEvent.id — dedup/logging key
  "occurredAt": string,  // ISO-8601, from the domain event
  "actor": { "userId": string },
  "payload": { ... }     // shapes above, field-for-field the REST output DTOs
}
```

The `payload` field reuses the exact output-DTO shapes (`TaskOutput`, `CommentOutput`) so the Flutter side models the payload with the same classes it already deserializes from REST — one model, two transports. Error messages on the wire (`auth_error`, room-rejection `error`) use the same `{ code, message }` fields as the REST error envelope; `correlationId` is deliberately absent (it's an HTTP-request tracing concept, per rest-api-reference Section 1).

**Documented envelope behavior, as shipped:**
- `member.removed` carries **no `actor`** (Section 3.2): the removed user is the event's *subject*, and the remover's identity is deliberately not exposed. Wire shape is `{ eventId, occurredAt, payload: { teamId, userId } }`.
- `comment.added` uses the **commenter** as `actor` (from the comment row), not the event's `userId` — the event's `userId` is the task owner (the notification recipient), not the actor.
- All other events use the event's `userId` as `actor` (the actor of the mutation, e.g. `scope.userId` for task events, `invitation.invitedBy` for `invitation.accepted`).

### 3.5 Client → Server events (complete table)

| Wire event | Payload | Purpose | Rate-limited (Section 11) |
|---|---|---|---|
| `typing` | `{ taskId, isTyping }` | comment-typing indicator (Section 6) | yes |
| *(optional v2)* `team.join` / `team.leave` | `{ teamId }` | explicit room control | yes |

That is the complete client→server surface. There is **no** client→server CRUD — creation/update/deletion continues exclusively over REST (the architectural rule). The server never treats a socket message as a write.

---

## 4. Rooms

### 4.1 Partitioning — confirmed, with one correction

The working assumption (one room per team `team:<teamId>`, plus one room per user `user:<userId>`) is **correct**, and it maps cleanly onto the personal-vs-team scope convention: `teamId: null` = personal (database reference Section 4) ⇔ personal events go to `user:<userId>`, `teamId: <uuid>` = team-scoped ⇔ team events go to `team:<teamId>`. That is the same nullable `team_id` discriminator the schema already uses — the realtime layer is one more consumer of the same convention, not a new one.

- `user:<userId>`: server joins the client's socket(s) to this room on connect, unconditionally. Carries personal-scope task/comment events. Also the natural future home for personal notifications.
- `team:<teamId>`: the collaboration room for team-scoped task/comment/member/presence events.

### 4.2 Join/leave lifecycle — server-verified, server-managed

**Recommendation: the server is the only thing that joins rooms.** On connect, the gateway:

1. joins `user:<userId>`;
2. queries `MemberRepository.listByUser(userId)` (**new additive method**, Section 0) and joins every `team:<id>` the user is currently a member of.

This removes the client from room control almost entirely and with it the whole class of "client asks to join a room it isn't authorized for" bugs — there is no join to authorize because the server derives membership from the database. (The optional `team.join`/`team.leave` client events in Section 3.5 exist only if we later want explicit navigation-driven control; if they're added, each is validated with the exact check below.)

Membership changes while connected:

- **User removed from a team** → `MEMBER_REMOVED` (Section 3.2) lets the realtime consumer call `socket.leave('team:<id>')` on the removed user's sockets and broadcast `member.removed` to the remaining members. This is the leak-closing path and is in v1.
- **User added to a team while connected** → v1 does not force-join mid-connection; the new membership takes effect on the next reconnect (natural on foreground/background). Documented v1 limitation; `MEMBER_ADDED` is the v2 fix (Section 3.2).

### 4.3 Authorization — reuse `TeamMembershipGuard`'s check, not its HTTP shape

`TeamMembershipGuard` does exactly two things that matter: `MemberRepository.findByTeamAndUser(teamId, user.id)` (403 if absent) and the `ROLE_RANK` hierarchy. The gateway's room logic reuses the **same repository call** for any membership question (including the optional client `team.join`). It does not need the role-hierarchy part, because rooms carry events that are member-wide (a VIEWER legitimately sees team task/comment events — the REST list endpoints already allow any member to read them). So: room membership = `findByTeamAndUser` present, no role rank. One repository method, one consistent source of truth, no third implementation of the membership concept.

---

## 5. Presence

> **Shipped in R3 (2026-08-15).** Implementation notes that differ from the prose below: presence events carry the standard Section 3.4 envelope with a generated `eventId` and `actor: { userId }`; the team list is cached in `client.data.teams` at connect so the offline broadcast needs no DB query (a membership added mid-connection therefore applies on reconnect, consistent with Section 4.2); `NotificationModule` imports `RealtimeModule` to reach the registry (no cycle).

### 5.1 Definition of "online"

**"Online" = the user has ≥1 connected, authenticated socket.** Connection-level only.

- Rationale: connection-level presence is free — the gateway already knows the connection. "Actively viewing a specific screen" would require per-screen heartbeat/state messages from the client and per-screen server state, which is meaningful extra complexity for no product requirement today (the app has no "who's watching this task" screen in v1 — that would be the later per-task collaboration feature in Section 6).
- **Not building in v1:** per-task "is anyone viewing this task" indicators. Flagged as the natural v2 extension of the collaboration layer, where screen-level state would become justified.

### 5.2 Tracking and broadcast

- In-memory `PresenceRegistry` service: `Map<userId, Set<socketId>>`. Updated on `handleConnection`/`handleDisconnect` (the socket id is needed because one user can be connected on several devices).
- On first connection (empty→non-empty) the server emits `user.online { userId }` to every team room the user belongs to; on last disconnect (non-empty→empty) it emits `user.offline`. Same `listByUser` query as Section 4.2 — this is precisely why that method is needed in v1 regardless of the auto-join decision.
- Because room membership is server-verified (Section 4), presence can never be broadcast into a room the user isn't in — no leaking presence of non-members to a team.

### 5.3 Multi-instance gap (ties to Section 1.3)

In-memory presence is correct for a single instance and **incomplete across instances**: a user on instance B is not in instance A's map, so (a) their `online` state is missing from rosters served by A, and (b) FCM suppression (Section 2.4) is incomplete. **Deferred, not built in R0** — consistent with the Redis-adapter decision. Migration path when >1 instance exists: back `PresenceRegistry` with a Redis set (`SETEX user:<id>:presence`) or use the Redis adapter's cluster-wide `fetchSockets()`; both are contained behind the same `PresenceRegistry` interface, so the swap is internal.

### 5.4 Privacy — flagged as a design decision (genuinely open)

There is no existing privacy convention in the app that constrains this (no "online visibility" setting; `UserSettings` only has `dark_mode`/`notifications_enabled`/`language`). The honest options:

1. **Presence visible to team members only** (recommended): online/offline is shown in the team roster. Simple, matches the collaboration goal, and consistent with "any member can read team resources."
2. **Presence visible to team members, with a per-user opt-out** in `UserSettings`: costs a new settings field + an additive column, and one more setting surface to maintain.
3. **No presence at all in v1**: drops `user.online`/`user.offline` and the roster UI; keeps everything else. Cheapest, but removes a headline "it feels live" signal.

**I recommend (1) and flag (2)/(3) for your call** — this is the one place in the plan where a privacy judgment has no existing precedent to lean on.

---

## 6. Collaboration (live editing signals)

### 6.1 What "live collaboration" means for this app — grounded in real screens

This app's collaboration surface today is: `TaskDetailsScreen` (task fields + done toggle), `AddTaskScreen` (edit), `CommentsScreen` (comment threads on a task, entered from TaskDetailsScreen), `TeamDetailsScreen` (roster/analytics), and the task list. Grounded v1 features:

1. **Live team task state (the headline feature).** When a team member creates/updates/completes/reopens/deletes a team task, every connected member's `TaskProvider` updates live (`task.*` events → idempotent upsert/remove). A user watching `TaskDetailsScreen` while a teammate toggles the task sees the status flip without pulling-to-refresh. This is the highest-value, lowest-cost real-time capability and the one that matches the "notification of change" mandate exactly.
2. **Live comments.** When a comment lands on a task whose `CommentsScreen` is open, it appears immediately (`comment.added` → `CommentProvider` append).
3. **Typing indicator on the comment composer.** `typing { taskId, isTyping }` client→server→`team:<id>` broadcast; the server stamps the sender's `userId`; a client viewing that task's `CommentsScreen` shows "X is typing…". Delivered at team-room granularity with client-side `taskId` filtering (keeps room count minimal; task rooms would be a per-screen optimization with no functional gain at this scale — flagged as an option, not recommended for v1).

> **SHIPPED (R4, 2026-08-15):** the server-side relay is built. `RealtimeGateway.handleTyping` resolves `taskId → teamId` via `TaskRepository.findById`, verifies the sender's membership through the socket's joined rooms (`client.rooms.has` — no extra DB query), stamps `userId`, and broadcasts the Section 3.3 envelope to `team:<id>`. Payload `userId` is never trusted from the wire. Client→server `typing` events are rate-limited per Section 11.1.
4. **Presence roster** (`user.online`/`user.offline` in `TeamDetailsScreen`) — per Section 5.4 decision.

### 6.2 Scope boundary — explicitly out

**No real-time collaborative text editing.** No operational-transform/CRDT machinery, no cursor sharing, no multi-user merge of a shared rich document. The data model (discrete tasks, discrete comments) has no shared mutable document to merge; two users editing the same *task* resolve through last-write-wins at the field level (Section 7), which the existing REST PATCH semantics already define. Collaborative text editing would be a separate, significantly more complex problem with no product evidence this app needs it — it is excluded deliberately, not silently.

---

## 7. Conflict Resolution

### 7.1 The actual scenario

Two connected clients concurrently `PATCH` different fields of the same task (or the same field). Both writes go over REST; both eventually read-modify-write the row in `TaskService`. The backend today has **no version/ETag/optimistic-lock on `TaskEntity`** (confirmed: no `version` column, no `If-Match`, no `updated_at`-based guard anywhere in the task flow). Its semantics are therefore **last-write-wins at the request level**: whichever PATCH lands last determines the persisted value for the fields it touched, and there is no conflict signal to the loser.

### 7.2 Recommendation: LWW, surfaced live — Socket.IO invents no new semantics

Socket.IO does not need to add conflict handling, because the conflict *already resolves* deterministically on the server. The realtime layer's only job is to deliver the resulting state to the other client (`task.updated` → full `TaskOutput`). The "conflict" a user might perceive ("I set priority=high but it's back to medium") is the *same* outcome they'd get today by pulling-to-refresh — realtime just makes it visible instantly. This is the correct scope: **reuse the existing REST semantics, don't create a parallel write path with different rules.**

Complex alternatives (client merge heuristics, per-field PATCH semantics changes, ETag + 409 conflict handling, CRDT) are explicitly rejected for v1: none is warranted by the feature set, and any of them would change REST behavior, violating the "Socket.IO is additive" rule.

### 7.3 Interaction with the client-generated-UUID optimistic pattern

The established Flutter pattern (database reference Section 1; `TaskProvider`): client generates the task UUID, optimistically applies the change, rolls back on `ApiException`. Realtime delivery layers on top **cleanly**, with one rule:

- **Provider updates are idempotent upserts keyed by task id.** When a client's own REST write produces a `task.*` event echo (the actor is in the room too), the upsert re-applies the same state the client already holds — harmless. No eventId-based "ignore my own" bookkeeping is needed, which is important because the client cannot know its own REST write's event id in advance.
- For a team task that arrives via realtime but is not in the client's local list (e.g. filtered out by date), the upsert inserts it; the existing `todayTasks`/`tomorrowTasks` getters filter it out on display, so it's invisible until it belongs. Consistent with the current list behavior.
- Rollback-on-error is untouched: REST failures still roll back; realtime events only ever *add* state, never trigger a write.

---

## 8. Offline Sync

### 8.1 Recommendation: re-fetch current state via REST on reconnect

**Recommendation: on reconnect, the client re-fetches current state over the existing REST endpoints** (`taskProvider.loadTasks()`, `teamProvider.loadTeams()`, `notificationProvider.load()`), the same way the FCM foreground handler already refreshes (`main.dart:101-105`). No server-side event replay in v1.

Rationale, grounded in what actually exists:

- **Socket.IO's built-in "connection state recovery" (server option, 4.6+) is not available here.** It is unsupported by the Redis adapter (confirmed in the adapter docs), which this plan adopts in R0 for the multi-instance case. Building replay on a single-instance-only feature would be a trap.
- **`activity_logs` cannot reconstruct team-wide history.** It is per-user, per-actor: a row exists only for the *actor* of an event (`activity_logs.user_id` = the event's `userId`; database reference Section 5), and its `entity_id` is the task id, not a team id. "What changed in team X since timestamp T" is not answerable from this table without a schema/work change — every team member would need their own copy of every team event, which is precisely what the *notification/activity* layer is not designed to be.
- The re-fetch approach is both simpler and sufficient: the data volumes are small (a user's tasks/teams/notifications), the REST list endpoints already return exactly the client's current screen state, and the re-fetch happens at most once per reconnect.

### 8.2 A bespoke replay is feasible but explicitly deferred

If event replay is ever wanted, the honest shape is: client sends "last known `occurredAt`/event id" per room on reconnect, server answers "what changed since X" — which would require a new query surface (and effectively a team-wide event history, i.e. a real event-sourcing table or a new per-team query on a new column). That is a schema-affecting feature with no current product driver. **Documented as the known trade-off of the refetch recommendation**, not silently omitted.

---

## 9. Backend Implementation Shape

### 9.1 Module layout — `src/modules/realtime/`, matching the existing conventions

New module following the `notification`/`team` module shape (module + controllers/services/interfaces/entities layering; controllers only where there's HTTP surface — the gateway plays the controller role here):

```
src/modules/realtime/
├── realtime.module.ts                  # imports LoggerModule, TaskEventsModule, TypeOrmModule.forFeature([TeamMemberEntity]), FirebaseModule; exports PresenceRegistry
├── gateways/
│   └── realtime.gateway.ts             # @WebSocketGateway() — connection lifecycle, handshake auth, auto-join, typing, (optional) team.join/leave
├── services/
│   ├── realtime-event-consumer.service.ts   # implements TaskEventConsumer, OnModuleInit; eventBus.register(this) — the Section 3.3 router
│   ├── presence-registry.service.ts         # implements PresenceRegistry (in-memory Map<userId, Set<socketId>>)
│   └── realtime-rate-limiter.service.ts     # Section 11 fixed-window limiter
├── interfaces/
│   └── presence-registry.ts            # abstract class, mirrors the repository-interface convention (in-memory impl now, Redis impl later)
├── dto/
│   ├── realtime.event.ts               # the RealtimeEnvelope + per-event payload interfaces (TaskOutput/CommentOutput reused)
│   └── typing.dto.ts                   # client→server payload contracts (type-only)
└── realtime.constants.ts               # room-name helpers (teamRoom(), userRoom()), wire event name constants
```

Plus, at infrastructure level:
- `src/infrastructure/realtime/redis-io.adapter.ts` — the `IoAdapter` subclass (Section 1.3), wired from `main.ts` when `REDIS_URL` is set.
- `src/infrastructure/events/task-event.ts` — additive `teamId?: string` field.
- `src/modules/member/interfaces/member-repository.ts` + `repositories/typeorm-member.repository.ts` — additive `listByUser(userId)`.
- `src/modules/member/services/member.service.ts` — emits the new `MEMBER_REMOVED` event on `removeMember()`.
- `src/modules/notification/services/notification.service.ts` — one injected `PresenceRegistry` + one guard around the push dispatch (Section 2.4).

### 9.2 How it plugs into `TaskEventBus`

Concretely, mirroring `NotificationService` exactly (`activity-log.service.ts:15-26` is the template):

```ts
@Injectable()
export class RealtimeEventConsumer implements TaskEventConsumer, OnModuleInit {
  constructor(private readonly eventBus: TaskEventBus, /* server, registry, logger */) {}
  onModuleInit(): void { this.eventBus.register(this); }
  async handle(event: TaskEvent): Promise<void> { /* Section 3.3 router */ }
}
```

The router needs the live `Server` instance to emit. Recommendation: the gateway, which owns `@WebSocketServer()`, registers the `Server` into the consumer (or the consumer is a provider the gateway shares) — either way a single module-local wiring, no bus changes. The `TaskEventBus` is untouched; this is another consumer on the same `dispatch()` loop, exactly as the plan's architectural rule requires. Delivery is best-effort like the other consumers (an emit failure is logged, never propagated — consistent with the "side effects must never fail the originating write" rule from ADR-0007 and `task-event-bus.service.ts`).

### 9.3 Config additions (following the established pattern)

New vars in `configuration.ts`, `validation.schema.ts`, and `.env.example`, exactly like the `firebase.*`/`appCheck.*` blocks:

- `REALTIME_EVENT_RATE_LIMIT` (default 60) / `REALTIME_EVENT_RATE_TTL_MS` (default 30_000) — per-user client→server event budget (Section 11).
- Optional `REALTIME_CORS_ORIGIN` — if left empty, the gateway reuses the existing `app.corsOrigin` so sockets and REST share one origin policy (recommended default).

### 9.4 `main.ts` changes

- `app.useWebSocketAdapter(new RedisIoAdapter(app))` when `redis.url` is non-empty (Section 1.3).
- No other bootstrap change: the gateway attaches to the existing HTTP server.

---

## 10. Flutter Implementation Shape

### 10.1 New service — `RealtimeService` (`lib/shared/services/realtime_service.dart`)

Same injectable, static-`instance`, facade pattern as `PushService`/`AppCheckService`:

- Constructor takes `AppServices?` (for `baseUrl` + `tokenStore`) and an injectable socket factory so widget tests can substitute a fake (`socket_io_client`'s `IO.io` is not constructible in tests, mirroring how `FcmPushMessaging` is abstracted behind `PushMessaging` in `push_service.dart`).
- `connect()` reads the access token from `TokenStore`, builds the socket (`OptionBuilder().setTransports(['websocket']).setAuth({'token': token})`), registers handlers.
- `disconnect()` on logout (mirrors `PushService.revokeCurrentToken` being called from the auth flow).
- `connect_error`/`auth_error` handling: on `auth_error` (or a connect rejection) the service triggers the existing refresh path (reuse `apiClient.refreshCallback`) and retries once; on failure, calls the `onSessionExpired`-style handler → login screen. No new auth logic — the same callbacks `main.dart` already wires for the HTTP layer.
- Lifecycle: `main.dart` calls `RealtimeService.instance.connect()` after session restore (post-`SplashScreen`), and `AuthProvider` invokes connect/disconnect on login/logout. On reconnect, the existing provider re-fetch runs (Section 8). The service is null in widget tests, so every hook no-ops — the exact `PushService`/`CrashlyticsService` null-instance convention.

> **SHIPPED (R6, 2026-08-15).** Implemented as `lib/shared/services/realtime_service.dart` with the injectable factory as the `RealtimeConnectionFactory` typedef; the service reuses `ApiClient.refreshAccessToken()` (which already drives `refreshCallback` + token-store rotation) for its one handshake retry. `main.dart` wires `onSessionExpired → authProvider.logout()` and the `onReconnected` re-fetch closure; `AuthProvider._syncRealtime` runs inside `_restore`/`_applyAuthResult`; the splash screen re-connects post-restore as an idempotent guard. 14 unit tests in `test/realtime_service_test.dart`.

### 10.2 How providers consume events — recommend a central dispatcher, consistent with Round 2

Round 2's established pattern is central wiring: `push.onForegroundMessage = () { notificationProvider.load(); taskProvider.loadTasks(); }` — a closure set in `main.dart` (lines 101-105). Realtime keeps that shape and extends it:

- `RealtimeService` exposes **typed, coarse handlers** (`onTaskEvent`, `onCommentEvent`, `onPresence`, `onTyping`) that `main.dart` wires to the global providers, exactly like the push foreground closure:
  - `task.*` → `TaskProvider.applyRealtimeEvent(event)` (idempotent upsert/remove, Section 7.3);
  - `member.removed` → `TeamProvider.loadTeams()` (roster correctness for the affected members);
  - `invitation.accepted` → `TeamProvider.loadTeams()` + `NotificationProvider.load()`;
  - `user.online/offline` → `TeamProvider` presence map.
- **Screen-scoped consumers** (`CommentsScreen` typing indicator, `TaskDetailsScreen` live state) subscribe directly to the service's per-screen callback registry in `initState` and unsubscribe in `dispose` — the same registration discipline the providers already use. The comments `CommentProvider` gains one method (`applyRealtimeComment`) rather than a wholesale re-fetch.
- This is a **central dispatcher with thin per-screen subscriptions**, not N providers each owning their own socket — one socket per app, one place owning the connection lifecycle, providers remain passive state holders. It is the smallest deviation from the Round 2 pattern that actually delivers per-screen updates.

> **SHIPPED (R7, 2026-08-15).** `main.dart` wires `onTaskEvent = taskProvider.applyRealtimeEvent`, `onPresence = teamProvider.applyPresence`, `onMemberRemoved` → `loadTeams()`, and `onInvitationAccepted` → `loadTeams()` + `notificationProvider.load()`, all guarded by `authProvider.isLoggedIn`. The screen-scoped registries are `RealtimeService.subscribeComment`/`subscribeTyping`/`subscribeMemberRemoved`, each returning a `VoidCallback` unsubscribe; `_dispatch` invokes both the coarse handler and any subscribers for `comment.added`/`typing`/`member.removed`. `RealtimeEnvelope` carries `eventName` so providers branch without a callback per event. `CommentsScreen` subscribes in `initState`/unsubscribes in `dispose` (filtering by `widget.taskId`, excluding the current user, with a 4 s auto-expire timer per typist); `TeamDetailsScreen` subscribes to `member.removed` and reloads its roster when the `teamId` matches.

### 10.3 UI surface (v1)

- `TeamDetailsScreen`: presence dots from the `TeamProvider` presence map.
- `CommentsScreen`: live comment append + "X is typing…" line, driven by the screen-scoped subscription.
- `TaskDetailsScreen`/task lists: live state via `TaskProvider.applyRealtimeEvent` (no screen change needed — the existing widgets rebuild from provider state).

---

## 11. Security Considerations

### 11.1 Rate limiting — the Socket.IO-appropriate equivalent

`ThrottlerGuard` is HTTP-scoped and does not run for gateways. Define a **fixed-window per-user limiter** for client→server events, implemented as `RealtimeRateLimiter` (a `Map<userId, { windowStart, count }>` with a TTL sweep), applied in the gateway middleware before any client→server handler:

> **SHIPPED (R4, 2026-08-15):** `RealtimeRateLimiter` (interface) + `InMemoryRealtimeRateLimiter` (`Map<userId, { windowStart, count }>` with a lazy per-key TTL sweep; `allow(userId, now?)` → boolean; `disconnect(userId)` frees the entry). Wired as `client.use` per-packet middleware registered after handshake auth in `RealtimeGateway`; provided by `RealtimeModule` and swap-ready for a Redis-backed impl via the same interface.

- Budget: `REALTIME_EVENT_RATE_LIMIT` (default 60) client→server messages per `REALTIME_EVENT_RATE_TTL_MS` (default 30 s) per user. `typing` is the only realistic flood vector; room join/leave is trivially small. Exceeded → `client.emit('error', { code: 'RATE_LIMITED', message: ... })` (same `code` string as the REST `429` path so the Flutter error mapper already handles it) and drop the message.
- Per-instance is acceptable in v1: the limiter stops abuse of a single app instance; a Redis-backed limiter is a trivial swap later (same interface pattern as `PresenceRegistry`). This mirrors the throttle philosophy in rest-api-reference Section 6 (tight limits exactly where flooding is plausible).

### 11.2 App Check — monitor-mode only, verified at handshake

`AppCheckGuard` is an HTTP `APP_GUARD`; it never sees sockets. The socket equivalent: the client includes its current App Check token in the handshake `auth` payload alongside the JWT; the gateway verifies it via the **same** `FirebaseAdminService.getAppCheck().verifyToken()` used by `AppCheckGuard` (Round 6), and logs `realtime_app_check_pass` / `realtime_app_check_reject` / `realtime_app_check_missing` — **and never blocks**, consistent with the project's current monitor-mode stance (`APP_CHECK_ENFORCE=false`). Skipped entirely (like the HTTP guard) when Firebase is not configured (dev/test). Enforcement on sockets stays tied to the same future decision as HTTP enforcement — flipping to enforce would be one boolean at the handshake, mirroring `APP_CHECK_ENFORCE`.

### 11.3 Room authorization

Already covered in Section 4.3: server-only room joins derived from the membership table; any membership question reuses `MemberRepository.findByTeamAndUser`. Realtime never widens who can see what: a client can only ever be in rooms its membership warrants, and presence can only broadcast to rooms the subject is in.

---

## 12. Testing Strategy

The project's test layout (rest-api-reference + firebase-integration-plan): unit specs co-located (`*.spec.ts`), integration specs under `test/integration/*.integration-spec.ts` booting the full `AppModule` via `bootstrapApp()` against in-memory sqlite, plus `test/app.e2e-spec.ts`. Socket.IO changes test tooling in two ways: gateways need `socket.io-client` (or a mocked `Server`) rather than supertest, and integration specs must bind a real ephemeral port.

### 12.1 Backend unit specs (co-located, mock the transport)

- `realtime-event-consumer.service.spec.ts` — the core mapping spec: a mocked `Server` whose `to(room).emit` is a spy; assert each `TaskEventType` (+`teamId` presence/absence) maps to the correct room and exact payload shape, including the skip rules (TASK_ASSIGNED, USER_ROLE_CHANGED).
- `presence-registry.service.spec.ts` — connect/disconnect transitions, empty→non-empty / non-empty→empty edge, multi-device.
- `realtime-rate-limiter.service.spec.ts` — window budget, expiry, per-user isolation.
- `realtime.gateway.spec.ts` — handshake auth (valid/expired/malformed token → `auth_error` + disconnect), auto-join (`listByUser` → room membership), `typing` relay stamps `userId` and never trusts the payload's.
- `notification.service.spec.ts` — new case: presence online ⇒ push not dispatched, notification row still created.

### 12.2 Backend integration spec — `test/integration/realtime.integration-spec.ts`

> **SHIPPED in R5 (2026-08-15).** Implementation notes that differ from the prose below: `bootstrapApp` takes an optional `pushDispatcher` override so the FCM scenario injects a spy `PushDispatcher` (rather than a `PushService`); the scenario 5 removal case creates its own fresh team so the shared sign-up fixture (used by the FCM and typing scenarios) is never mutated; `WIRE_EVENTS` collects every expected wire event (including `disconnect`) so late-arriving events can be asserted without missing them; the typing relay is covered as its own scenario 9; and the rate-limiter scenario floods `typing` beyond the default `realtime.eventRateLimit` budget.

Socket.IO testing needs a live server, so this spec differs from the supertest-based peers in one way: after `bootstrapApp()`, `await app.listen(0)` and use `app.getHttpServer().address().port` to build `io('http://127.0.0.1:<port>', { transports: ['websocket'], auth: { token } })` with `socket.io-client` (a devDependency, same major version as the server). Scenarios:

1. Sign up two users via REST (`signUp` helper), create a team, add the second user as a member.
2. Connect both sockets; assert both receive the other's `user.online` (membership-scoped).
3. User A creates a team task over REST → assert B's socket receives `task.created` with a `TaskOutput` payload; assert a non-member's socket receives nothing.
4. Connect a third user who is *not* a member → assert they receive no team events at all (room-scope leak check).
5. Remove B from the team via REST → assert B's socket is force-left (no further team events) and A receives `member.removed`.
6. FCM suppression: with B connected, A comments on a team task → assert B got `comment.added` and that no push was dispatched (inject a spy `PushService`).
7. Handshake auth: expired/invalid token → `auth_error` + disconnect.
8. Rate limiter: flood `typing` beyond the budget → `RATE_LIMITED` error event, messages dropped.

### 12.3 Flutter tests

- `RealtimeService` unit tests against a fake socket client (injectable factory): connect/disconnect, auth-payload shape, reconnect-with-refreshed-token, `auth_error` → session-expired path.
- Provider tests: `TaskProvider.applyRealtimeEvent` upsert/remove/idempotent-echo; `CommentProvider.applyRealtimeComment`; `TeamProvider` presence map.
- Widget tests keep `RealtimeService.instance` null (no-ops), so the existing 185+ test suite stays hermetic — the established null-instance convention. Verification gates: `flutter analyze` zero issues, `flutter test` full suite.

> **SHIPPED (R6, 2026-08-15).** `test/realtime_service_test.dart` added (14 tests) against a `FakeRealtimeConnection` injected via the factory: auth-payload shape (websocket transport, token `auth`, `autoConnect` false), no-token no-op, idempotent connect, disconnect teardown + reset, `connect_error`/`auth_error` → one refresh → retry with rotated token, failed refresh → `onSessionExpired` + token-store cleared, single-refresh-per-failure guard, `onReconnected` only after the first connect, full Section 3.3 routing, malformed-envelope drop, `sendTyping` only-when-connected, wire `error` no-throw. Full suite 185 → 199 tests, `flutter analyze` zero issues.

> **SHIPPED (R7, 2026-08-15).** 22 new tests. `test/realtime_service_test.dart` gained the screen-scoped-subscription group (4: `subscribeComment` receives + unsubscribes, `subscribeTyping`, `subscribeMemberRemoved`, coarse handler + subscribers both fire). `test/task_provider_test.dart` gained `applyRealtimeEvent` (7: created/updated/completed upsert, deleted removes, deleted-unknown no-op, idempotent echo keeps a single instance, malformed payload dropped). `test/comment_provider_test.dart` gained `applyRealtimeComment` (4: appends live, ignores another task, drops the duplicate echo id, no-op before load). `test/team_provider_test.dart` gained the presence group (3: online/offline tracking + `isOnline`, notify only on membership change, malformed payload ignored). `test/realtime_screens_test.dart` added (4 widget tests against a live `RealtimeService` + fake connection): comments screen appends a live comment, typing indicator appears/clears, team-details online dot (Semantics label), team-details roster reload on `member.removed`. Full suite 199 → 221 tests, `flutter analyze` zero issues, `flutter build apk --debug` succeeds. R8 will cover security polish & docs.

---

## 13. Implementation Order & Dependencies

Each round is a small, committable unit with its own validation checkpoint, matching how the Database/REST/Firebase rounds were scoped. Backend verification = `npm run build`, `npm run lint`, `npm test` (+ `test:integration` from R5); Flutter verification = `flutter analyze`, `flutter test`.

- **R0 — Transport & handshake.** ✅ **SHIPPED (2026-08-14).** Backend deps (`@nestjs/websockets` 11.1.26, `@nestjs/platform-socket.io` 11.1.29, `@socket.io/redis-adapter` 8.2.1; `socket.io-client` 4.8.3 as devDependency), `RealtimeModule` skeleton, `RealtimeGateway` connection lifecycle + JWT handshake auth + `user:<id>` auto-join, `RedisIoAdapter` gated on `REDIS_URL` + `main.ts` wiring, config vars (`REALTIME_EVENT_RATE_LIMIT`, `REALTIME_EVENT_RATE_TTL_MS`). Verified: build, lint (0 errors), 340 unit / 37 integration / 44 e2e, plus a live socket.io-client smoke test (no-token reject, invalid-token reject, valid-token room membership).
- **R1 — Rooms & membership.** ✅ **SHIPPED (2026-08-15).** `MemberRepository.listByUser` (+ TypeORM impl), server-side `team:<id>` auto-join on connect (from the membership table, never client claims), `MEMBER_REMOVED` event + `RealtimeEventConsumer` force-leave/broadcast. Verified: build, lint (0 errors), 347 unit tests (gateway: 6; consumer: 5; member service: publish assertion).
- **R2 — Domain-event routing.** ✅ **SHIPPED (2026-08-15).** `teamId?: string` on `TaskEvent`, populated by all four emitters (`task.service` `emit`/`emitAssigned`, `comment.service` `create`, `invitation.service` `accept`); `RealtimeEventConsumer` is now the Section 3.3 router — task state events (reconstructed `TaskOutput` via `TaskRepository.findByIdWithTags`), `task.deleted` (event-carried `{ taskId, title, teamId }`, no fetch), `comment.added` (reconstructed `CommentOutput`, commenter as actor), `invitation.accepted`, plus the `TASK_ASSIGNED`/`USER_ROLE_CHANGED` skip rules; `RealtimeEnvelope` + payload types in `dto/realtime.event.ts`. Verified: build, lint (0 errors), 357 unit tests (emitters assert `teamId`; consumer router: 15 cases).
- **R3 — Presence & FCM suppression.** ✅ **SHIPPED (2026-08-15).** `PresenceRegistry` (interface + in-memory `Map<userId, Set<socketId>>` impl), gateway registers/unregisters sockets and broadcasts `user.online`/`user.offline` (envelope shape, `{ userId }` payload) to the user's team rooms — team list cached on the socket at connect so the offline broadcast needs no DB query — and `NotificationService` skips only the push dispatch when `isUserOnline(event.userId)` (row still written); `RealtimeModule` exports the registry, `NotificationModule` imports it. Verified: build, lint (0 errors), 366 unit tests (registry: 4; gateway: 10; notification suppression: 1), 37 integration tests (boots the new module dependency).
- **R4 — Collaboration typing relay & rate limiting.** ✅ **SHIPPED (2026-08-15).** `RealtimeRateLimiter` (interface + in-memory fixed-window `Map<userId, { windowStart, count }>` impl with lazy TTL sweep; budget `REALTIME_EVENT_RATE_LIMIT` (default 60) per `REALTIME_EVENT_RATE_TTL_MS` (default 30 s) per user), applied via `client.use` per-packet middleware registered after auth — over budget: drop the message and `client.emit('error', { code: 'RATE_LIMITED', message: 'Too many events' })` (same code string as the REST 429 path); `typing { taskId, isTyping }` client→server handler that resolves the task via `TaskRepository.findById`, derives the team room, verifies the sender's membership via the socket's joined rooms (no extra DB query), and relays the Section 3.3 envelope with the sender's `userId` stamped (`payload.userId` never trusted from the wire); `rateLimiter.disconnect(userId)` on socket close. Verified: build, lint (0 errors), 376 unit tests (rate limiter: 4; gateway: 16 incl. 2 rate-limit + 4 typing-relay cases), 37 integration tests (boots `RealtimeRateLimiter` provider).
- **R5 — Integration tests.** ✅ **SHIPPED (2026-08-15).** `test/integration/realtime.integration-spec.ts` — a live `socket.io-client` (same major as the server) against `app.listen(0)`'s ephemeral port; `bootstrapApp` gained a `pushDispatcher` override so the FCM test injects a spy `PushDispatcher`. 9 tests: presence `user.online`/`user.offline` (membership-scoped, offline broadcast reaches the team), `task.created` relay to members with a `TaskOutput` payload, non-member leak check (Carol gets nothing), member force-leave + `member.removed` (uses its own freshly-created team so the shared fixture stays intact), FCM suppression (online Bob gets `comment.added`, no push; after disconnect, exactly one `pushDispatch` with the registered `deviceTokens`), invalid token → `auth_error` `UNAUTHORIZED`, missing token → `AUTH_TOKEN_MISSING`, typing flood → `RATE_LIMITED` + messages dropped, and `typing` relay (envelope `actor.userId` + stamped `payload.userId`). `WIRE_EVENTS` collector (incl. `disconnect`) + `waitFor`/`assertQuiet` helpers. Verified: build, lint (0 errors), 376 unit / 46 integration tests (37 pre-existing + 9 new).
- **R6 — Flutter `RealtimeService`.** ✅ **SHIPPED (2026-08-15).** `socket_io_client ^3.1.6` dependency; `lib/shared/services/realtime_service.dart` — `RealtimeConnection`/`SocketIoConnection` facade + `RealtimeConnectionFactory` (injectable `IO.io`), `RealtimeEnvelope` parser (Section 3.4), typed coarse handlers, `connect` (websocket-only transport, `autoConnect` disabled, JWT `auth` payload), `disconnect`, `sendTyping`, handshake recovery (connect_error/auth_error → one token refresh via `ApiClient.refreshAccessToken` → retry; refresh failure → `onSessionExpired` + `apiClient.onSessionExpired`), `onReconnected` re-fetch hook gated on `_everConnected`, `isConnected`; wiring in `main.dart` (singleton instance, session-expired → `authProvider.logout()`, reconnect → `loadTasks`/`loadTeams`/`load`), `AuthProvider` (`_syncRealtime` in `_restore` + `_applyAuthResult`, disconnect in `logout`), splash screen (post-restore connect). Verified: `flutter analyze` (0 issues), `flutter test` (185 → 199 tests, 14 new in `test/realtime_service_test.dart`).
- **R7 — Flutter provider dispatch & UI.** ✅ **SHIPPED (2026-08-15).** `TaskProvider.applyRealtimeEvent` (eventName-branched upsert/delete, malformed-payload guards, notify-on-change), `CommentProvider.applyRealtimeComment` (task-scoped via `_taskId`, dedup by id, insertion-sorted by `createdAt`), `TeamProvider` presence map (`onlineUserIds`, `isOnline`, `applyPresence`), `RealtimeService` screen-scoped registries (`subscribeComment`/`subscribeTyping`/`subscribeMemberRemoved`) + `eventName` on `RealtimeEnvelope`, `main.dart` central dispatcher wiring, `CommentsScreen` live comments + typing indicator + `sendTyping` relay, `TeamDetailsScreen` presence dots + `member.removed` roster reload, l10n keys `someone_is_typing`/`online`/`offline` (en/ar/fr). Verified: `flutter analyze` (0 issues), `flutter test` (199 → 221 tests, 22 new), `flutter build apk --debug` (builds).
- **R8 — Security polish & docs.** Handshake App Check (monitor-mode only), optional session-revocation disconnect (Section 2.2 alternative), Redis presence if desired, final full-suite pass on both sides, update the three reference docs + this plan's status to reflect shipped rounds. *Checkpoint:* everything green.

---

## 14. Decisions needed from you (flagged, not silently chosen)

**Confirmed by the project owner (2026-08-14) — closed:**

1. **Presence privacy** (§5.4): **CONFIRMED — visible to team members** (option 1). `user.online`/`user.offline` broadcast to the user's team rooms; no opt-out setting in v1.
2. **`TaskEvent.teamId` additive change** (§3.1): **CONFIRMED — add now**, along with the four emitter-site updates (task/comment/invitation/admin). Backward-compatible; verified no existing consumer breaks.
3. **`MEMBER_REMOVED` new domain event** (§3.2): **CONFIRMED — add now** (enum value + `MemberService.removeMember` emit + realtime consumer force-leave).
4. **Redis adapter** (§1.3): **CONFIRMED — built day-one, gated on `REDIS_URL`**, falling back gracefully to the in-process IoAdapter (single instance) when unset. Shipped in R0.

**Still open (your call before their rounds):**

5. **Proactive server-side disconnect on JWT expiry** (§2.2): recommended *no* (handshake-only auth; reconnect presents a fresh token).
6. **Client-driven `team.join/leave`** (§3.5/§4.2): recommended *not* in v1 (server-only room joins).
7. **Typing delivery granularity** (§6.1): team-room + client filter (recommended) vs. per-task rooms.
8. **Offline sync** (§8): re-fetch on reconnect (recommended) vs. bespoke replay (schema-affecting, deferred).
