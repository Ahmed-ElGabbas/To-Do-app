import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { LoggerService } from '../../../common/logger/logger.service';
import { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { MemberRepository } from '../../member/interfaces/member-repository';
import { TaskRepository } from '../../task/interfaces/task-repository';
import { AccessTokenPayload } from '../../auth/strategies/jwt.strategy';
import { RealtimeEventConsumer } from '../services/realtime-event-consumer.service';
import { PresenceRegistry } from '../interfaces/presence-registry';
import { RealtimeRateLimiter } from '../interfaces/realtime-rate-limiter';
import { REALTIME_EVENTS, teamRoom, userRoom } from '../realtime.constants';

interface TypingPayload {
  taskId: string;
  isTyping: boolean;
}

/**
 * Socket.IO connection lifecycle. The HTTP JwtAuthGuard is an APP_GUARD and
 * does not cover gateways, so the handshake verifies the same JWT access
 * token (same secret, same payload contract as the HTTP JwtStrategy) here.
 * Verified users are joined to their `user:<id>` room and — from the
 * membership table, never from client claims — to every `team:<id>` room
 * they belong to.
 *
 * Client→server surface (Section 3.5): `typing { taskId, isTyping }`. The
 * server resolves the task's team, verifies the sender is a member (their
 * socket is in that team's room — membership is server-managed, so no extra
 * query), then relays to the team room with the sender's `userId` stamped in
 * the envelope actor + payload. Every inbound packet first passes the
 * per-user fixed-window limiter (Section 11.1); exceeding the budget drops
 * the message and emits `error { code: 'RATE_LIMITED' }` — the same code the
 * REST 429 path uses.
 *
 * Presence (Section 5): the first socket of a user triggers `user.online` to
 * every team room they belong to; the last disconnect triggers `user.offline`.
 * The team list is cached on the socket at connect time so the offline
 * broadcast needs no DB query and stays consistent with room membership.
 *
 * CORS mirrors `app.corsOrigin` (same env var + default as configuration.ts)
 * so sockets and the REST API share one origin policy; a Flutter client is
 * unaffected by CORS either way.
 */
@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly members: MemberRepository,
    private readonly eventConsumer: RealtimeEventConsumer,
    private readonly presence: PresenceRegistry,
    private readonly rateLimiter: RealtimeRateLimiter,
    private readonly tasks: TaskRepository,
    private readonly logger: LoggerService,
  ) {}

  afterInit(server: Server): void {
    this.eventConsumer.bindServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      this.reject(client, 'AUTH_TOKEN_MISSING', 'Missing authentication token');
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        { secret: this.config.get<string>('jwt.secret', '') },
      );
      const user: AuthenticatedUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      client.data.user = user;
      this.registerPacketMiddleware(client, user);
      client.on(REALTIME_EVENTS.TYPING, (raw: unknown) => {
        void this.handleTyping(client, raw);
      });
      await client.join(userRoom(user.id));
      const memberships = await this.members.listByUser(user.id);
      const teamIds = memberships.map((membership) => membership.teamId);
      client.data.teams = teamIds;
      for (const teamId of teamIds) {
        await client.join(teamRoom(teamId));
      }
      const wentOnline = this.presence.register(user.id, client.id);
      if (wentOnline) {
        this.broadcastPresence(teamIds, REALTIME_EVENTS.USER_ONLINE, user.id);
      }
      this.logger.info('realtime_connected', {
        userId: user.id,
        teams: memberships.length,
      });
    } catch {
      this.reject(client, 'UNAUTHORIZED', 'Invalid or expired token');
    }
  }

  handleDisconnect(client: Socket): void {
    const user = client.data.user as AuthenticatedUser | undefined;
    if (user) {
      this.rateLimiter.disconnect(user.id);
      const teamIds = (client.data.teams as string[] | undefined) ?? [];
      const wentOffline = this.presence.unregister(user.id, client.id);
      if (wentOffline) {
        this.broadcastPresence(teamIds, REALTIME_EVENTS.USER_OFFLINE, user.id);
      }
      this.logger.info('realtime_disconnected', { userId: user.id });
    }
  }

  /**
   * Per-packet middleware: drops any client→server message that exceeds the
   * user's fixed-window budget (Section 11.1). The sender is notified with the
   * REST 429 code so the Flutter error mapper already understands it.
   */
  private registerPacketMiddleware(
    client: Socket,
    user: AuthenticatedUser,
  ): void {
    client.use(([event], next) => {
      if (typeof event !== 'string' || this.rateLimiter.allow(user.id)) {
        next();
        return;
      }
      client.emit(REALTIME_EVENTS.ERROR, {
        code: 'RATE_LIMITED',
        message: 'Too many events',
      });
    });
  }

  /** Relays a comment-typing indicator to the task's team room. */
  private async handleTyping(client: Socket, raw: unknown): Promise<void> {
    const user = client.data.user as AuthenticatedUser | undefined;
    const payload = parseTypingPayload(raw);
    if (!user || !payload) {
      return;
    }
    const task = await this.tasks.findById(payload.taskId);
    if (!task || !task.teamId) {
      return;
    }
    const room = teamRoom(task.teamId);
    if (!client.rooms.has(room)) {
      return;
    }
    if (!this.server) {
      return;
    }
    const typing = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      actor: { userId: user.id },
      payload: { taskId: task.id, userId: user.id, isTyping: payload.isTyping },
    };
    this.server.to(room).emit(REALTIME_EVENTS.TYPING, typing);
  }

  private broadcastPresence(
    teamIds: string[],
    wireEvent: string,
    userId: string,
  ): void {
    if (!this.server) {
      return;
    }
    const presence = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      actor: { userId },
      payload: { userId },
    };
    for (const teamId of teamIds) {
      this.server.to(teamRoom(teamId)).emit(wireEvent, presence);
    }
  }

  private extractToken(client: Socket): string | undefined {
    const auth = client.handshake.auth as Record<string, unknown> | undefined;
    return typeof auth?.token === 'string' ? auth.token : undefined;
  }

  private reject(client: Socket, code: string, message: string): void {
    client.emit(REALTIME_EVENTS.AUTH_ERROR, { code, message });
    client.disconnect(true);
  }
}

/** Accepts only `{ taskId: string, isTyping: boolean }`; anything else drops. */
function parseTypingPayload(raw: unknown): TypingPayload | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (
    typeof record.taskId !== 'string' ||
    typeof record.isTyping !== 'boolean'
  ) {
    return null;
  }
  return { taskId: record.taskId, isTyping: record.isTyping };
}
