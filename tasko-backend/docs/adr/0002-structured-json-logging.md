# ADR-0002: Structured JSON Logging

- Status: Accepted
- Date: 2026-08-01

## Context

Operational logs must be machine-parseable and carry request context
(correlation ids) so failures can be traced across request lifecycle events.

## Decision

- A single `LoggerService` implements the Nest `LoggerService` interface so it
  can be passed to `app.useLogger()`.
- Every entry is a single-line JSON object: `level`, `timestamp`, `context`,
  and structured `message` (fields such as `correlationId`).
- Log levels map to console methods: debug/trace/warn/error standard; `info`
  writes via `console.info`.
- The HTTP `LoggingInterceptor` emits `request_start` and `request_end` with a
  correlation id; the mailer integration logs `mail_sent`.

## Consequences

- Centralized, filterable logs in all tiers.
- `LoggerService` has no constructor parameters (avoids DI injecting a context
  string); context is set imperatively via `setContext()`.
