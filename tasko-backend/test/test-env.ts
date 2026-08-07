// Seeds process.env with hermetic test defaults. MUST be imported before
// AppModule: @nestjs/config reads (and, for unset keys, writes back into)
// process.env the moment ConfigModule.forRoot() runs, which happens while
// AppModule is being imported.
//
// Values are only set when unset so a CI job can run these suites against a
// real Postgres service container by setting DB_TYPE=postgres (+ DB_HOST etc.)
// — those are already in process.env before this module executes. sqlite tiers
// auto-sync by default (ADR-0004); Postgres never does (schema comes from
// migrations), so DB_SYNCHRONIZE is defaulted only for the sqlite tier.
if (process.env.NODE_ENV === undefined) process.env.NODE_ENV = 'test';
if (process.env.DB_TYPE === undefined) process.env.DB_TYPE = 'sqlite';
if (process.env.DB_FILE === undefined) process.env.DB_FILE = ':memory:';
if (process.env.JWT_SECRET === undefined) {
  process.env.JWT_SECRET = 'test-secret-that-is-definitely-long-enough-123456';
}
if (process.env.REDIS_URL === undefined) process.env.REDIS_URL = '';
if (process.env.SMTP_HOST === undefined) process.env.SMTP_HOST = '';
if (process.env.MAIL_FROM === undefined)
  process.env.MAIL_FROM = 'no-reply@tasko.dev';
if (
  process.env.DB_TYPE === 'sqlite' &&
  process.env.DB_SYNCHRONIZE === undefined
) {
  process.env.DB_SYNCHRONIZE = 'true';
}
