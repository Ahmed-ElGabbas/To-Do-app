# ADR-0001: Global Configuration with Fail-Fast Validation

- Status: Accepted
- Date: 2026-08-01

## Context

The backend must run in multiple tiers (local, test, prod) with different
runtime dependencies. Missing or malformed environment variables cause
confusing, hard-to-diagnose runtime failures.

## Decision

- A single global `ConfigurationModule` (Nest `ConfigModule.forRoot({ isGlobal: true })`)
  registers the Joi `validation.schema` for the whole app.
- Validation is `abortEarly: false` (report every invalid key) with
  `allowUnknown: true` (forward-compatible env vars) and `convert: true`.
- Defaults are supplied via `config.get(key, fallback)` so the process can boot
  with sensible local defaults (sqlite, in-memory cache, noop mailer/push).
- Sensitive/required secrets (e.g. `jwt.secret`, length >= 32) fail fast at boot.

## Consequences

- Invalid config surfaces immediately at startup instead of mid-request.
- All tiers share one validation contract; the test tier reuses the same schema.
- Strict null checks force explicit defaults, preventing `undefined` at runtime.
