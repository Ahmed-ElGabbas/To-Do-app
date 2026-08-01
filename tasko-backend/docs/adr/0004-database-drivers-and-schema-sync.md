# ADR-0004: Database Drivers per Environment and Schema Policy

- Status: Accepted
- Date: 2026-08-01

## Context

No Docker is available on the local environment, so a local Postgres container
cannot back development/testing. Production targets Postgres.

## Decision

- Local dev and automated tests use `better-sqlite3` via TypeORM:
  `DB_TYPE=sqlite`, `DB_FILE=:memory:` for tests.
- Production uses Postgres (`DB_TYPE=postgres`).
- `synchronize` is enabled only for sqlite tiers (schema parity with prod
  migrations is tracked separately); it is never enabled for Postgres.
- Date columns use `type: 'datetime'` explicitly because better-sqlite3 does
  not support `type: 'timestamp'` nor inferred `Object` for nullable dates.

## Consequences

- Tests run in-memory with no external services and start quickly.
- The same TypeORM entity definitions drive both tiers.
- Prod schema changes must go through migrations, not `synchronize`.
