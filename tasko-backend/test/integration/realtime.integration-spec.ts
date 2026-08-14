import { ConfigService } from '@nestjs/config';
import type { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { IntegrationContext, bootstrapApp, signUp } from './helpers';

jest.setTimeout(30000);

const TASK_BODY = { title: 'Realtime task', time: '10:00 AM', date: 'today' };
const SETTLE_MS = 150;
const DEVICE_TOKEN = 'rt-fcm-device-token';

/** Wire names the spec listens for; mirrors RealtimeConstants. */
const WIRE_EVENTS = [
  'auth_error',
  'disconnect',
  'task.created',
  'task.updated',
  'task.completed',
  'task.reopened',
  'task.deleted',
  'comment.added',
  'invitation.accepted',
  'member.removed',
  'user.online',
  'user.offline',
  'typing',
  'error',
] as const;

interface ReceivedEvent {
  event: string;
  data: unknown;
}

interface Envelope {
  eventId: string;
  occurredAt: string;
  actor?: { userId: string };
  payload: Record<string, unknown>;
}

describe('realtime integration', () => {
  let ctx: IntegrationContext;
  let port: number;
  let pushDispatch: jest.Mock;

  let aliceToken: string;
  let bobToken: string;
  let carolToken: string;
  let aliceId: string;
  let bobId: string;
  let teamId: string;

  const received = new Map<Socket, ReceivedEvent[]>();
  const connected: Socket[] = [];

  beforeAll(async () => {
    pushDispatch = jest.fn();
    ctx = await bootstrapApp({ pushDispatcher: { dispatch: pushDispatch } });
    await ctx.app.listen(0);
    port = (ctx.app.getHttpServer().address() as AddressInfo).port;

    aliceToken = await signUp(ctx.http, 'rt-alice@example.com');
    bobToken = await signUp(ctx.http, 'rt-bob@example.com');
    carolToken = await signUp(ctx.http, 'rt-carol@example.com');
    aliceId = await currentUserId(aliceToken);
    bobId = await currentUserId(bobToken);

    const team = await request(ctx.http)
      .post('/teams')
      .set(auth(aliceToken))
      .send({ name: 'Realtime Squad' })
      .expect(201);
    teamId = team.body.data.id;

    await request(ctx.http)
      .post(`/teams/${teamId}/members`)
      .set(auth(aliceToken))
      .send({ email: 'rt-bob@example.com', role: 'editor' })
      .expect(201);
  });

  afterAll(async () => {
    for (const socket of connected) {
      socket.disconnect();
    }
    connected.length = 0;
    await ctx.app.close();
  });

  beforeEach(() => {
    pushDispatch.mockClear();
    ctx.throttlerStorage.storage.clear();
  });

  afterEach(() => {
    for (const socket of connected) {
      if (socket.connected) {
        socket.disconnect();
      }
    }
    connected.length = 0;
    received.clear();
  });

  function auth(token: string): { Authorization: string } {
    return { Authorization: `Bearer ${token}` };
  }

  async function currentUserId(token: string): Promise<string> {
    const res = await request(ctx.http)
      .get('/users/me')
      .set(auth(token))
      .expect(200);
    return res.body.data.id as string;
  }

  function openRaw(token: string): Socket {
    const socket = io(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
    });
    const events: ReceivedEvent[] = [];
    received.set(socket, events);
    for (const name of WIRE_EVENTS) {
      socket.on(name, (data: unknown) => {
        events.push({ event: name, data });
      });
    }
    return socket;
  }

  /** Connects a socket with the given token, resolving once the handshake lands. */
  function connect(token: string): Promise<Socket> {
    const socket = openRaw(token);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('socket connect timed out')),
        5000,
      );
      socket.once('connect', () => {
        clearTimeout(timer);
        connected.push(socket);
        resolve(socket);
      });
      socket.once('connect_error', (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /** Resolves with the next (or already-received) matching payload. */
  function waitFor<T>(
    socket: Socket,
    event: string,
    predicate?: (data: T) => boolean,
    timeoutMs = 5000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const events = received.get(socket) ?? [];
      const existing = events.find(
        (entry) =>
          entry.event === event && (!predicate || predicate(entry.data as T)),
      );
      if (existing) {
        resolve(existing.data as T);
        return;
      }
      const timer = setTimeout(() => {
        socket.off(event, handler);
        reject(
          new Error(`Timed out after ${timeoutMs}ms waiting for "${event}"`),
        );
      }, timeoutMs);
      const handler = (data: T) => {
        if (!predicate || predicate(data)) {
          clearTimeout(timer);
          socket.off(event, handler);
          resolve(data);
        }
      };
      socket.on(event, handler);
    });
  }

  /** Asserts the socket received no (matching) events after a settle delay. */
  async function assertQuiet(
    socket: Socket,
    event?: string,
    settleMs = SETTLE_MS,
  ): Promise<void> {
    await delay(settleMs);
    const events = received.get(socket) ?? [];
    const matching = event
      ? events.filter((entry) => entry.event === event)
      : events;
    expect(matching).toHaveLength(0);
  }

  it('broadcasts user.online/user.offline to team rooms (membership-scoped)', async () => {
    const alice = await connect(aliceToken);
    const aliceEcho = await waitFor<Envelope>(alice, 'user.online', (data) => {
      return data.payload.userId === aliceId;
    });
    expect(aliceEcho.actor?.userId).toBe(aliceId);

    const bob = await connect(bobToken);
    const bobOnline = await waitFor<Envelope>(alice, 'user.online', (data) => {
      return data.payload.userId === bobId;
    });
    expect(bobOnline.actor?.userId).toBe(bobId);
    expect(bobOnline.payload.userId).toBe(bobId);

    await waitFor<Envelope>(bob, 'user.online', (data) => {
      return data.payload.userId === bobId;
    });

    const bobSeesOffline = waitFor<Envelope>(bob, 'user.offline', (data) => {
      return data.payload.userId === aliceId;
    });
    alice.disconnect();
    expect((await bobSeesOffline).payload.userId).toBe(aliceId);
  });

  it('relays task.created to members with a TaskOutput payload', async () => {
    await connect(aliceToken);
    const bob = await connect(bobToken);
    await waitFor<Envelope>(bob, 'user.online');

    const gotCreated = waitFor<Envelope>(bob, 'task.created');
    const created = await request(ctx.http)
      .post(`/teams/${teamId}/tasks`)
      .set(auth(aliceToken))
      .send(TASK_BODY)
      .expect(201);
    const taskId = created.body.data.id as string;

    const env = await gotCreated;
    expect(env.actor?.userId).toBe(aliceId);
    expect(env.payload.task).toMatchObject({
      id: taskId,
      teamId,
      title: TASK_BODY.title,
    });
  });

  it('delivers nothing to a non-member socket (room-scope leak check)', async () => {
    const carol = await connect(carolToken);
    await assertQuiet(carol);

    await connect(aliceToken);
    const bob = await connect(bobToken);
    await waitFor<Envelope>(bob, 'user.online');

    const gotCreated = waitFor<Envelope>(bob, 'task.created');
    await request(ctx.http)
      .post(`/teams/${teamId}/tasks`)
      .set(auth(aliceToken))
      .send(TASK_BODY)
      .expect(201);
    await gotCreated;

    await assertQuiet(carol);
  });

  it('force-leaves a removed member and notifies the team (member.removed)', async () => {
    const own = await request(ctx.http)
      .post('/teams')
      .set(auth(aliceToken))
      .send({ name: 'Removal Squad' })
      .expect(201);
    const removalTeamId = own.body.data.id as string;
    await request(ctx.http)
      .post(`/teams/${removalTeamId}/members`)
      .set(auth(aliceToken))
      .send({ email: 'rt-bob@example.com', role: 'editor' })
      .expect(201);

    const alice = await connect(aliceToken);
    const bob = await connect(bobToken);
    await waitFor<Envelope>(alice, 'user.online', (data) => {
      return data.payload.userId === bobId;
    });

    const gotRemoved = waitFor<Envelope>(alice, 'member.removed');
    await request(ctx.http)
      .delete(`/teams/${removalTeamId}/members/${bobId}`)
      .set(auth(aliceToken))
      .expect(200);
    expect(await gotRemoved).toMatchObject({
      payload: { teamId: removalTeamId, userId: bobId },
    });

    await request(ctx.http)
      .post(`/teams/${removalTeamId}/tasks`)
      .set(auth(aliceToken))
      .send(TASK_BODY)
      .expect(201);
    await assertQuiet(bob, 'task.created');
  });

  it('suppresses the FCM push for an online recipient but dispatches once offline', async () => {
    await connect(aliceToken);
    const bob = await connect(bobToken);
    await waitFor<Envelope>(bob, 'user.online');

    await request(ctx.http)
      .post('/notifications/devices')
      .set(auth(bobToken))
      .send({ token: DEVICE_TOKEN, platform: 'android' })
      .expect(201);

    const bobTask = await request(ctx.http)
      .post(`/teams/${teamId}/tasks`)
      .set(auth(bobToken))
      .send(TASK_BODY)
      .expect(201);
    const taskId = bobTask.body.data.id as string;

    const gotComment = waitFor<Envelope>(bob, 'comment.added');
    await request(ctx.http)
      .post(`/tasks/${taskId}/comments`)
      .set(auth(aliceToken))
      .send({ body: 'LGTM' })
      .expect(201);
    const env = await gotComment;
    expect(env.actor?.userId).toBe(aliceId);
    expect(env.payload.task).toMatchObject({ id: taskId });
    expect(env.payload.comment).toMatchObject({ body: 'LGTM' });

    expect(pushDispatch).not.toHaveBeenCalled();
    const list = await request(ctx.http)
      .get('/notifications')
      .set(auth(bobToken))
      .expect(200);
    expect(list.body.data.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'comment_added',
          data: expect.objectContaining({ taskId }),
        }),
      ]),
    );

    await disconnectSafely(bob);
    await delay(SETTLE_MS);

    await request(ctx.http)
      .post(`/tasks/${taskId}/comments`)
      .set(auth(aliceToken))
      .send({ body: 'One more thought' })
      .expect(201);
    expect(pushDispatch).toHaveBeenCalledTimes(1);
    expect(pushDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ deviceTokens: [DEVICE_TOKEN] }),
    );
  });

  it('rejects an invalid token with auth_error and disconnects', async () => {
    const socket = openRaw('not-a-real-token');
    const err = await waitFor<{ code?: string }>(socket, 'auth_error');
    expect(err.code).toBe('UNAUTHORIZED');
    await waitFor(socket, 'disconnect');
    socket.disconnect();
  });

  it('rejects a connection without a token with auth_error and disconnects', async () => {
    const socket = openRaw('');
    const err = await waitFor<{ code?: string }>(socket, 'auth_error');
    expect(err.code).toBe('AUTH_TOKEN_MISSING');
    await waitFor(socket, 'disconnect');
    socket.disconnect();
  });

  it('rate limits client packets and emits RATE_LIMITED over budget', async () => {
    const alice = await connect(aliceToken);
    await waitFor<Envelope>(alice, 'user.online');

    const rateLimit = ctx.app
      .get(ConfigService)
      .get<number>('realtime.eventRateLimit', 60);
    const taskId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

    const errored = waitFor(alice, 'error', (data: unknown) => {
      return (data as { code?: string })?.code === 'RATE_LIMITED';
    });
    for (let i = 0; i < rateLimit; i++) {
      alice.emit('typing', { taskId, isTyping: true });
    }
    alice.emit('typing', { taskId, isTyping: true });
    expect(await errored).toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('relays typing to teammates in the task team room with the sender stamped', async () => {
    const task = await request(ctx.http)
      .post(`/teams/${teamId}/tasks`)
      .set(auth(aliceToken))
      .send(TASK_BODY)
      .expect(201);
    const taskId = task.body.data.id as string;

    const alice = await connect(aliceToken);
    const bob = await connect(bobToken);
    await waitFor<Envelope>(bob, 'user.online');

    const gotTyping = waitFor<Envelope>(bob, 'typing', (data) => {
      return data.payload.taskId === taskId;
    });
    alice.emit('typing', { taskId, isTyping: true });

    const env = await gotTyping;
    expect(env.actor?.userId).toBe(aliceId);
    expect(env.payload).toMatchObject({
      taskId,
      userId: aliceId,
      isTyping: true,
    });
  });
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function disconnectSafely(socket: Socket): Promise<void> {
  if (socket.connected) {
    socket.disconnect();
    await new Promise<void>((resolve) => {
      socket.once('disconnect', () => resolve());
      setTimeout(resolve, 200);
    });
  }
}
