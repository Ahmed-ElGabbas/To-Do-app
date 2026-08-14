/**
 * Presence contract (Section 5 of the realtime plan): a per-user set of
 * connected socket ids. "Online" = the user has at least one connected,
 * authenticated socket. The in-memory implementation lives in
 * `services/presence-registry.service.ts`; a Redis-backed implementation can
 * be swapped in behind this same interface (Section 5.3 migration path).
 */
export abstract class PresenceRegistry {
  /**
   * Records a connected socket. Returns true when this was the user's first
   * connection (empty -> non-empty), signalling the `user.online` broadcast.
   */
  abstract register(userId: string, socketId: string): boolean;

  /**
   * Removes a disconnected socket. Returns true when the user has no sockets
   * left (non-empty -> empty), signalling the `user.offline` broadcast.
   */
  abstract unregister(userId: string, socketId: string): boolean;

  /** True when the user has at least one connected socket. */
  abstract isUserOnline(userId: string): boolean;
}
