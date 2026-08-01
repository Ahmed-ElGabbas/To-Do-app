# ADR-0005: Response and Error Envelope

- Status: Accepted
- Date: 2026-08-01

## Context

The Flutter client and external consumers need a stable, predictable API
contract for both success and failure paths.

## Decision

- All success responses are wrapped by the global `TransformInterceptor` as
  `{ success: true, data: <payload> }`.
- All failures are rendered by the global `HttpExceptionFilter` as
  `{ success: false, error: { code, message, details? } }`.
- `code` is derived from the HTTP status via `codeForStatus()`:
  `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
  `RATE_LIMITED`, `HTTP_ERROR`.
- Health endpoints are excluded from the envelope (`@SkipTransform`) so
  infrastructure probes get the raw expected shape.
- A 408 timeout and a 429 rate-limit response both map to their specific codes.

## Consequences

- Client type-safety: one success shape and one error shape.
- Error `code` is stable across reworded messages.
