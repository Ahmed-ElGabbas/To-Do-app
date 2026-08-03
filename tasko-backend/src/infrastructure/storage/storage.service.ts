/**
 * Storage abstraction for user-uploaded files (Phase 2: avatars only).
 *
 * The concrete implementation is selected from configuration (see
 * StorageModule): local disk for dev/test, S3-compatible object storage in
 * production. Service code only ever talks to this interface, so object
 * storage can be swapped without touching business logic.
 */
export abstract class StorageService {
  /** Writes `data` under `key`. Callers must guarantee unique keys. */
  abstract save(key: string, data: Buffer, contentType: string): Promise<void>;

  /** Returns a URL usable for a limited time to fetch the stored object. */
  abstract getUrl(key: string): Promise<string>;

  /** Deletes the stored object. Missing objects are treated as success. */
  abstract delete(key: string): Promise<void>;
}
