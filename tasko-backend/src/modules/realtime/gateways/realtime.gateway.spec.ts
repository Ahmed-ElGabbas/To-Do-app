import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { FirebaseAdminService } from '../../../infrastructure/firebase/firebase-admin.service';
import { LoggerService } from '../../../common/logger/logger.service';
import { MemberRepository } from '../../member/interfaces/member-repository';
import { TaskRepository } from '../../task/interfaces/task-repository';
import { PresenceRegistry } from '../interfaces/presence-registry';
import { RealtimeEventConsumer } from '../services/realtime-event-consumer.service';
import { REALTIME_EVENTS, teamRoom, userRoom } from '../realtime.constants';
import { RealtimeGateway } from './realtime.gateway';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'member@tasko.dev';
const TOKEN = 'a-signed-access-token';
const SECRET = 'test-secret';
const SOCKET_ID = 'socket-1';
const TEAM_ONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TEAM_TWO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TASK_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

interface MockSocketClient {
  id: string;
  handshake: { auth?: unknown };
  data: {
    user?: { id: string; email: string; role: string };
    teams?: string[];
  };
  rooms: Set<string>;
  join: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
  use: jest.Mock;
  on: jest.Mock;
}

function makeClient(auth?: unknown): MockSocketClient {
  return {
    id: SOCKET_ID,
    handshake: { auth },
    data: {},
    rooms: new Set(),
    join: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    disconnect: jest.fn(),
    use: jest.fn(),
    on: jest.fn(),
  };
}

function asSocket(client: MockSocketClient): Socket {
  return client as unknown as Socket;
}

function validUser() {
  return { id: USER_ID, email: EMAIL, role: 'user' };
}

function validPayload() {
  return { sub: USER_ID, email: EMAIL, role: 'user' };
}

describe('RealtimeGateway', () => {
  const jwtService = { verifyAsync: jest.fn() };
  const config = { get: jest.fn() };
  const firebase = { isConfigured: jest.fn(), getAppCheck: jest.fn() };
  const members = { listByUser: jest.fn() };
  const eventConsumer = { bindServer: jest.fn() };
  const presence = { register: jest.fn(), unregister: jest.fn() };
  const rateLimiter = { allow: jest.fn(), disconnect: jest.fn() };
  const tasks = { findById: jest.fn() };
  const logger = {
    setContext: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    verbose: jest.fn(),
    fatal: jest.fn(),
  };
  let gateway: RealtimeGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'jwt.secret' ? SECRET : fallback,
    );
    firebase.isConfigured.mockReturnValue(false);
    gateway = new RealtimeGateway(
      jwtService as unknown as JwtService,
      config as unknown as ConfigService,
      firebase as unknown as FirebaseAdminService,
      members as unknown as MemberRepository,
      eventConsumer as unknown as RealtimeEventConsumer,
      presence as unknown as PresenceRegistry,
      rateLimiter,
      tasks as unknown as TaskRepository,
      logger as unknown as LoggerService,
    );
  });

  it('gives the event consumer the live server on init', () => {
    const server = {} as Server;
    gateway.afterInit(server);
    expect(eventConsumer.bindServer).toHaveBeenCalledWith(server);
  });

  it('rejects a connection without a token', async () => {
    const client = makeClient(undefined);

    await gateway.handleConnection(client);

    expect(client.emit).toHaveBeenCalledWith(REALTIME_EVENTS.AUTH_ERROR, {
      code: 'AUTH_TOKEN_MISSING',
      message: 'Missing authentication token',
    });
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
    expect(members.listByUser).not.toHaveBeenCalled();
    expect(presence.register).not.toHaveBeenCalled();
    expect(client.use).not.toHaveBeenCalled();
  });

  it('rejects a connection with an invalid or expired token', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('expired'));
    const client = makeClient({ token: TOKEN });

    await gateway.handleConnection(client);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith(TOKEN, {
      secret: SECRET,
    });
    expect(client.emit).toHaveBeenCalledWith(REALTIME_EVENTS.AUTH_ERROR, {
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
    expect(client.use).not.toHaveBeenCalled();
  });

  it('verifies a valid token and joins the user and team rooms', async () => {
    jwtService.verifyAsync.mockResolvedValue(validPayload());
    members.listByUser.mockResolvedValue([
      { teamId: TEAM_ONE },
      { teamId: TEAM_TWO },
    ]);
    presence.register.mockReturnValue(true);
    const client = makeClient({ token: TOKEN });

    await gateway.handleConnection(client);

    expect(client.data.user).toEqual(validUser());
    expect(client.data.teams).toEqual([TEAM_ONE, TEAM_TWO]);
    expect(client.join).toHaveBeenCalledWith(userRoom(USER_ID));
    expect(client.join).toHaveBeenCalledWith(teamRoom(TEAM_ONE));
    expect(client.join).toHaveBeenCalledWith(teamRoom(TEAM_TWO));
    expect(members.listByUser).toHaveBeenCalledWith(USER_ID);
    expect(presence.register).toHaveBeenCalledWith(USER_ID, SOCKET_ID);
    expect(client.emit).not.toHaveBeenCalled();
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('joins the user room even when the user has no teams', async () => {
    jwtService.verifyAsync.mockResolvedValue(validPayload());
    members.listByUser.mockResolvedValue([]);
    const client = makeClient({ token: TOKEN });

    await gateway.handleConnection(client);

    expect(client.join).toHaveBeenCalledWith(userRoom(USER_ID));
    expect(client.join).toHaveBeenCalledTimes(1);
  });

  describe('handshake App Check (Section 11.2)', () => {
    beforeEach(() => {
      firebase.isConfigured.mockReturnValue(true);
    });

    it('skips verification entirely when Firebase is not configured', async () => {
      firebase.isConfigured.mockReturnValue(false);
      jwtService.verifyAsync.mockResolvedValue(validPayload());
      members.listByUser.mockResolvedValue([]);
      const client = makeClient({ token: TOKEN, appCheckToken: 'abc' });

      await gateway.handleConnection(client);

      expect(firebase.getAppCheck).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(
        logger.info.mock.calls.some((call) =>
          String(call[0]).startsWith('realtime_app_check_'),
        ),
      ).toBe(false);
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('monitor mode connects and logs a missing app-check token', async () => {
      jwtService.verifyAsync.mockResolvedValue(validPayload());
      members.listByUser.mockResolvedValue([]);
      const client = makeClient({ token: TOKEN });

      await gateway.handleConnection(client);

      expect(logger.warn).toHaveBeenCalledWith(
        'realtime_app_check_missing',
        expect.objectContaining({ userId: USER_ID, enforce: false }),
      );
      expect(firebase.getAppCheck).not.toHaveBeenCalled();
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('monitor mode verifies and logs a valid app-check token', async () => {
      jwtService.verifyAsync.mockResolvedValue(validPayload());
      members.listByUser.mockResolvedValue([]);
      firebase.getAppCheck.mockReturnValue({
        verifyToken: jest
          .fn()
          .mockResolvedValue({ appId: '1:123:android:abc' }),
      });
      const client = makeClient({ token: TOKEN, appCheckToken: 'abc' });

      await gateway.handleConnection(client);

      expect(firebase.getAppCheck().verifyToken).toHaveBeenCalledWith('abc');
      expect(logger.info).toHaveBeenCalledWith(
        'realtime_app_check_pass',
        expect.objectContaining({
          userId: USER_ID,
          appId: '1:123:android:abc',
        }),
      );
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('monitor mode never blocks an invalid app-check token', async () => {
      jwtService.verifyAsync.mockResolvedValue(validPayload());
      members.listByUser.mockResolvedValue([]);
      firebase.getAppCheck.mockReturnValue({
        verifyToken: jest
          .fn()
          .mockRejectedValue(new Error('App Check token has expired')),
      });
      const client = makeClient({ token: TOKEN, appCheckToken: 'bad' });

      await gateway.handleConnection(client);

      expect(logger.warn).toHaveBeenCalledWith(
        'realtime_app_check_reject',
        expect.objectContaining({
          userId: USER_ID,
          enforce: false,
          message: 'App Check token has expired',
        }),
      );
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('enforce mode rejects a missing app-check token', async () => {
      config.get.mockImplementation((key: string, fallback?: unknown) =>
        key === 'appCheck.enforce'
          ? true
          : key === 'jwt.secret'
            ? SECRET
            : fallback,
      );
      jwtService.verifyAsync.mockResolvedValue(validPayload());
      members.listByUser.mockResolvedValue([]);
      const client = makeClient({ token: TOKEN });

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith(REALTIME_EVENTS.AUTH_ERROR, {
        code: 'APP_CHECK_FAILED',
        message: 'App Check token is required',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('enforce mode rejects an invalid app-check token', async () => {
      config.get.mockImplementation((key: string, fallback?: unknown) =>
        key === 'appCheck.enforce'
          ? true
          : key === 'jwt.secret'
            ? SECRET
            : fallback,
      );
      jwtService.verifyAsync.mockResolvedValue(validPayload());
      members.listByUser.mockResolvedValue([]);
      firebase.getAppCheck.mockReturnValue({
        verifyToken: jest.fn().mockRejectedValue(new Error('expired')),
      });
      const client = makeClient({ token: TOKEN, appCheckToken: 'bad' });

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith(REALTIME_EVENTS.AUTH_ERROR, {
        code: 'APP_CHECK_FAILED',
        message: 'App Check verification failed',
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('packet rate limiting', () => {
    let client: MockSocketClient;

    beforeEach(async () => {
      jwtService.verifyAsync.mockResolvedValue(validPayload());
      members.listByUser.mockResolvedValue([]);
      client = makeClient({ token: TOKEN });
      await gateway.handleConnection(client);
    });

    it('registers a per-packet middleware on successful connect', () => {
      expect(client.use).toHaveBeenCalledTimes(1);
      const middleware = client.use.mock.calls[0][0];
      const next = jest.fn();
      rateLimiter.allow.mockReturnValue(true);

      middleware(['typing', { taskId: TASK_ID, isTyping: true }], next);

      expect(rateLimiter.allow).toHaveBeenCalledWith(USER_ID);
      expect(next).toHaveBeenCalled();
      expect(client.emit).not.toHaveBeenCalled();
    });

    it('drops the message and emits RATE_LIMITED over the budget', () => {
      const middleware = client.use.mock.calls[0][0];
      const next = jest.fn();
      rateLimiter.allow.mockReturnValue(false);

      middleware(['typing', { taskId: TASK_ID, isTyping: true }], next);

      expect(next).not.toHaveBeenCalled();
      expect(client.emit).toHaveBeenCalledWith(REALTIME_EVENTS.ERROR, {
        code: 'RATE_LIMITED',
        message: 'Too many events',
      });
    });
  });

  describe('typing relay', () => {
    const roomEmits = jest.fn();
    const server = {
      to: jest.fn().mockReturnValue({ emit: roomEmits }),
    };

    async function connectTypingClient(rooms: string[]): Promise<{
      client: MockSocketClient;
      typing: (raw: unknown) => Promise<void>;
    }> {
      jwtService.verifyAsync.mockResolvedValue(validPayload());
      members.listByUser.mockResolvedValue([{ teamId: TEAM_ONE }]);
      const client = makeClient({ token: TOKEN });
      for (const room of rooms) {
        client.rooms.add(room);
      }
      await gateway.handleConnection(client);
      server.to.mockClear();
      roomEmits.mockClear();
      const handler = client.on.mock.calls.find(
        ([name]) => name === REALTIME_EVENTS.TYPING,
      )?.[1] as (raw: unknown) => Promise<void>;
      return { client, typing: handler };
    }

    beforeEach(() => {
      roomEmits.mockClear();
      server.to.mockClear();
      gateway.server = server as unknown as Server;
    });

    it('relays typing to the task team room with the sender stamped', async () => {
      tasks.findById.mockResolvedValue({ id: TASK_ID, teamId: TEAM_ONE });
      const { typing } = await connectTypingClient([teamRoom(TEAM_ONE)]);

      await typing({ taskId: TASK_ID, isTyping: true });

      expect(server.to).toHaveBeenCalledWith(teamRoom(TEAM_ONE));
      expect(roomEmits).toHaveBeenCalledWith(
        REALTIME_EVENTS.TYPING,
        expect.objectContaining({
          actor: { userId: USER_ID },
          payload: { taskId: TASK_ID, userId: USER_ID, isTyping: true },
        }),
      );
    });

    it('does not relay when the sender is not a member of the task team', async () => {
      tasks.findById.mockResolvedValue({ id: TASK_ID, teamId: TEAM_TWO });
      const { typing } = await connectTypingClient([teamRoom(TEAM_ONE)]);

      await typing({ taskId: TASK_ID, isTyping: true });

      expect(server.to).not.toHaveBeenCalled();
    });

    it('does not relay personal or unknown tasks', async () => {
      tasks.findById.mockResolvedValueOnce({ id: TASK_ID, teamId: null });
      tasks.findById.mockResolvedValueOnce(null);
      const { typing } = await connectTypingClient([teamRoom(TEAM_ONE)]);

      await typing({ taskId: TASK_ID, isTyping: true });
      await typing({ taskId: TASK_ID, isTyping: true });

      expect(server.to).not.toHaveBeenCalled();
    });

    it('drops malformed payloads', async () => {
      const { typing } = await connectTypingClient([teamRoom(TEAM_ONE)]);

      await typing(null);
      await typing({ taskId: TASK_ID });
      await typing({ taskId: TASK_ID, isTyping: 'yes' });

      expect(tasks.findById).not.toHaveBeenCalled();
      expect(server.to).not.toHaveBeenCalled();
    });
  });

  describe('presence broadcasts', () => {
    const roomEmits = jest.fn();
    const server = {
      to: jest.fn().mockReturnValue({ emit: roomEmits }),
    };

    beforeEach(() => {
      roomEmits.mockClear();
      server.to.mockClear();
      gateway.server = server as unknown as Server;
    });

    it('emits user.online to every team room on first connection', async () => {
      jwtService.verifyAsync.mockResolvedValue(validPayload());
      members.listByUser.mockResolvedValue([
        { teamId: TEAM_ONE },
        { teamId: TEAM_TWO },
      ]);
      presence.register.mockReturnValue(true);
      const client = makeClient({ token: TOKEN });

      await gateway.handleConnection(client);

      expect(server.to).toHaveBeenCalledWith(teamRoom(TEAM_ONE));
      expect(server.to).toHaveBeenCalledWith(teamRoom(TEAM_TWO));
      expect(roomEmits).toHaveBeenCalledTimes(2);
      expect(roomEmits).toHaveBeenCalledWith(
        REALTIME_EVENTS.USER_ONLINE,
        expect.objectContaining({
          actor: { userId: USER_ID },
          payload: { userId: USER_ID },
        }),
      );
    });

    it('does not emit user.online for a second device', async () => {
      jwtService.verifyAsync.mockResolvedValue(validPayload());
      members.listByUser.mockResolvedValue([]);
      presence.register.mockReturnValue(false);
      const client = makeClient({ token: TOKEN });

      await gateway.handleConnection(client);

      expect(roomEmits).not.toHaveBeenCalled();
    });

    it('emits user.offline to the cached team rooms on last disconnect', () => {
      presence.unregister.mockReturnValue(true);
      const client = makeClient({ token: TOKEN });
      client.data.user = validUser();
      client.data.teams = [TEAM_ONE, TEAM_TWO];

      gateway.handleDisconnect(asSocket(client));

      expect(presence.unregister).toHaveBeenCalledWith(USER_ID, SOCKET_ID);
      expect(server.to).toHaveBeenCalledWith(teamRoom(TEAM_ONE));
      expect(server.to).toHaveBeenCalledWith(teamRoom(TEAM_TWO));
      expect(roomEmits).toHaveBeenCalledTimes(2);
      expect(roomEmits).toHaveBeenCalledWith(
        REALTIME_EVENTS.USER_OFFLINE,
        expect.objectContaining({
          actor: { userId: USER_ID },
          payload: { userId: USER_ID },
        }),
      );
    });

    it('does not emit user.offline while other sockets remain', () => {
      presence.unregister.mockReturnValue(false);
      const client = makeClient({ token: TOKEN });
      client.data.user = validUser();
      client.data.teams = [TEAM_ONE];

      gateway.handleDisconnect(asSocket(client));

      expect(roomEmits).not.toHaveBeenCalled();
    });
  });

  it('logs the user and clears their rate window on disconnect', () => {
    presence.unregister.mockReturnValue(false);
    const client = makeClient({ token: TOKEN });
    client.data.user = validUser();

    gateway.handleDisconnect(asSocket(client));

    expect(rateLimiter.disconnect).toHaveBeenCalledWith(USER_ID);
    expect(logger.info).toHaveBeenCalledWith('realtime_disconnected', {
      userId: USER_ID,
    });
  });
});
