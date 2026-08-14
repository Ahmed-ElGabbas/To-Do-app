import { Injectable } from '@nestjs/common';
import { PresenceRegistry } from '../interfaces/presence-registry';

/**
 * In-memory presence: `Map<userId, Set<socketId>>` (socket id matters because
 * one user can be connected on several devices at once). Correct for a single
 * instance; incomplete across instances (Section 5.3) — a Redis-backed
 * implementation can replace this behind the same {@link PresenceRegistry}.
 */
@Injectable()
export class InMemoryPresenceRegistry extends PresenceRegistry {
  private readonly connections = new Map<string, Set<string>>();

  register(userId: string, socketId: string): boolean {
    let sockets = this.connections.get(userId);
    if (!sockets) {
      sockets = new Set();
      this.connections.set(userId, sockets);
    }
    const wasEmpty = sockets.size === 0;
    sockets.add(socketId);
    return wasEmpty;
  }

  unregister(userId: string, socketId: string): boolean {
    const sockets = this.connections.get(userId);
    if (!sockets) {
      return false;
    }
    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.connections.delete(userId);
      return true;
    }
    return false;
  }

  isUserOnline(userId: string): boolean {
    return (this.connections.get(userId)?.size ?? 0) > 0;
  }
}
