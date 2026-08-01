# ADR-0003: Opaque Refresh Tokens with Reuse Detection

- Status: Accepted
- Date: 2026-08-01

## Context

The identity core issues access + refresh tokens. Refresh tokens are stored
server-side for revocation. Using JWT-encoded refresh tokens with an empty
`{}` payload produces a deterministic serialized value that collides on a
unique `token_hash` column, and grants no claims benefit over an opaque token.

## Decision

- Refresh tokens are opaque, cryptographically random strings:
  `randomBytes(48).toString('base64url')` (~64 chars, 384 bits of entropy).
- Only the SHA-256 hash of the token is persisted (and indexed unique).
- Rotation: every refresh issues a new token; the previous record is revoked.
- Reuse detection: if a revoked token is presented, the entire token family is
  revoked (`revokeFamily`), invalidating all sibling sessions.
- Access tokens remain JWTs (HMAC `jwt.secret`) with `sub`, `email`, `role`.

## Consequences

- Deterministic JWT `{}` payload collisions are avoided entirely.
- Stolen refresh-token reuse is detected and neutralizes the whole family.
- No JWT verify is needed for refresh; lookup is a single indexed hash query.
