# ADR-0007: Async Event Dispatch, Notifications, and Activity Log

- Status: Accepted
- Date: 2026-08-01

## Context

Phase 3 adds two cross-cutting consumers of task lifecycle changes: in-app +
push notifications and an activity log. Rather than calling these services
synchronously from `TaskService`, task operations should publish domain events
(`task.created`, `task.completed`, `task.reopened`, `task.deleted`, `task.updated`)
so that:

- `TaskService` stays decoupled from notification/log concerns.
- Adding a new consumer does not touch task code.
- Side effects survive/retry when a consumer fails, and never break the task
  write itself.

Two infrastructure questions had to be pinned down: how events are dispatched
(with or without a queue) and how consumers register themselves.

## Decision

### Event bus with queue-first, in-process fallback

- `TaskEventBus` is the single entry point. It exposes `publish(event)` and
  `register(consumer)/unregister(consumer)`.
- When Redis is configured (`REDIS_URL`), a `Bull` queue `task-events` carries
  the event; a `TaskoWorker` processes each job by re-dispatching to consumers
  through the bus, and a `PushJobHandler` enqueues retryable push delivery.
  Job failures use `retryAttempts` (default 2) with exponential backoff so a
  transient failure does not lose the side effect.
- When Redis is absent (dev/tests), `publish` dispatches to consumers
  in-process in a fire-and-forget loop; a consumer error is logged and does
  not propagate to the publisher.
- `TaskEventsModule.forRoot()` is global and conditionally registers the worker
  and re-exports `BullModule` only when the queue is enabled, so the module
  graph stays valid in both modes.

### Self-registering consumers (registry pattern)

- Nest has no multi-provider concept, so multiple consumers cannot be bound
  to a single injection token. Instead:
  - `JobHandlerRegistry` keeps a `name -> handler` map for queue jobs.
  - Each consumer (`NotificationService`, `ActivityLogService`) implements
    `OnModuleInit` and calls `eventBus.register(this)`; `TaskEventBus` itself
    registers the `task-events` job handler in `JobHandlerRegistry` on init.
  - `PushJobHandler` registers itself in `JobHandlerRegistry` for the push job.
  - Both `register()` and `unregister()` are idempotent.
- Adding a consumer is a single self-registering class plus one module
  import — no bus or registry edits.

### Consumers

- `NotificationService` persists a `NotificationEntity` per event (id, type,
  title, read flag) and, when the user has devices, enqueues a push job.
  `DeviceTokenService` owns device CRUD; pushes are serialized per user so
  multiple devices receive the same payload.
- `ActivityLogService` persists an `ActivityLogEntity` per event; a query
  service exposes `GET /users/me/activity` with `type` filter and pagination.

## Consequences

- Task writes never depend on side effects succeeding; dispatch is
  best-effort with retries when a queue is present.
- Dev and CI run with no external dependency (in-process fallback).
- Consumers are load-bearing for the same request path in fallback mode, so
  they must be fast (DB inserts only; push enqueued separately).
- Events are written in the same transaction as the task? No — events are
  published after the task write completes. A crash between the write and the
  publish can lose a side effect (an outbox would close this gap; deferred to
  a later phase if it becomes a requirement).
