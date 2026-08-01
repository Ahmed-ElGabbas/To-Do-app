# ADR-0006: File Storage Abstraction and Task Date Filtering

- Status: Accepted
- Date: 2026-08-01

## Context

Phase 2 adds user-uploaded files (avatars) and server-side task filtering.
Two decisions need to be pinned down:

1. Where and how uploaded file bytes are stored in each environment.
2. How the client's relative task dates (`today`/`tomorrow`) are matched when
   the server lists tasks.

## Decision

### File storage

- Business code depends only on the `StorageService` abstraction with the
  narrow API `save(key, data, contentType)`, `getUrl(key)`, and `delete(key)`.
- The concrete driver is chosen from configuration in `StorageModule`
  (`STORAGE_DRIVER=local` for dev/tests, `=s3` for production).
- `LocalStorageService` writes under `UPLOAD_DIR`, serves files at
  `APP_BASE_URL/uploads/<key>`, creates parent directories recursively, and
  rejects path traversal and drive-qualified keys.
- `S3StorageService` uses the AWS SDK with pre-signed GET URLs (TTL from
  `S3_PRESIGN_TTL_SECONDS`) so private objects are never publicly exposed.
- Avatars use the storage key `avatars/<userId>/<uuid><ext>`; a user keeps at
  most one avatar (replacement deletes the previous file row and object).
- The business limit (`MAX_FILE_SIZE_MB`, default 5) is enforced in
  `FileService`; multer applies only a hard memory-bomb cap (25 MB) and a
  MIME allow-list (`jpeg`/`png`/`webp`/`gif`) at the interceptor layer.

### Task date filtering

- A task's `date` column stores the client's raw value verbatim:
  `today`, `tomorrow`, or `yyyy-MM-dd`. This keeps optimistic offline writes
  round-trippable.
- The `?date=today|tomorrow` query filter matches
  `date = <label> OR date = <ISO day>` where the ISO day is computed from the
  **server's local calendar**. Relative labels are not re-mapped to absolute
  dates at write time, so a task written yesterday as `today` keeps that label.
- Concrete ranges use `dateFrom`/`dateTo` compared lexicographically against
  the ISO string (valid because the format is zero-padded).

## Consequences

- Object storage can be swapped without touching business logic.
- Local uploads work in dev and tests with no external dependency.
- Relative task dates are deterministic for a given server timezone; clients
  with different timezones may observe off-by-one-day boundaries (accepted
  for the current single-region deployment).
