/**
 * Fixed-window, per-user limiter for client→server socket messages (Section
 * 11.1). The HTTP ThrottlerGuard never runs for gateways, so the realtime
 * layer enforces its own budget before any client→server handler runs.
 */
export abstract class RealtimeRateLimiter {
  /**
   * Consumes one message from the user's current window. Returns true when the
   * message is within budget; false when the user has exceeded it (the message
   * should be dropped and the sender notified with code `RATE_LIMITED`).
   */
  abstract allow(userId: string): boolean;

  /** Drops the user's window on disconnect so a reconnect starts fresh. */
  abstract disconnect(userId: string): void;
}
