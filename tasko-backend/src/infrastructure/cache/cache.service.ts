/**
 * Cache abstraction. In Phase 1 the implementation is in-memory when no Redis
 * is configured and Redis-backed otherwise, selected transparently in
 * CacheModule. Swap-in keeps callers (e.g. refresh-token cache) decoupled from
 * the concrete vendor.
 */
export abstract class CacheService {
  abstract get<T>(key: string): Promise<T | null>;
  abstract set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  abstract delete(key: string): Promise<void>;
  abstract ping(): Promise<boolean>;
}
