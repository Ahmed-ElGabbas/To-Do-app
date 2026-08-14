import { Test } from '@nestjs/testing';
import { Server } from 'socket.io';
import { LoggerService } from '../../../common/logger/logger.service';
import {
  TaskEvent,
  TaskEventType,
} from '../../../infrastructure/events/task-event';
import { TaskEventBus } from '../../../infrastructure/events/task-event-bus.service';
import { CommentRepository } from '../../comment/interfaces/comment-repository';
import { TaskRepository } from '../../task/interfaces/task-repository';
import { REALTIME_EVENTS, teamRoom, userRoom } from '../realtime.constants';
import { RealtimeEventConsumer } from './realtime-event-consumer.service';

const ACTOR = '11111111-1111-4111-8111-111111111111';
const REMOVED = '22222222-2222-4222-8222-222222222222';
const TEAM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EVENT_ID = '33333333-3333-4333-8333-333333333333';
const TASK_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const COMMENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function makeEvent(
  type: TaskEventType,
  overrides: Partial<TaskEvent> = {},
): TaskEvent {
  return {
    id: EVENT_ID,
    type,
    userId: ACTOR,
    occurredAt: '2026-01-01T00:00:00.000Z',
    data: {},
    ...overrides,
  };
}

const taskEntity = {
  id: TASK_ID,
  title: 'Buy milk',
  time: '06:30 AM',
  date: 'today',
  isDone: false,
  priority: 'medium',
  notes: null,
  teamId: TEAM_ID,
  categoryId: null,
  tags: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const commentEntity = {
  id: COMMENT_ID,
  taskId: TASK_ID,
  userId: ACTOR,
  body: 'Looks good',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('RealtimeEventConsumer', () => {
  const eventBus = { register: jest.fn() };
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
  const tasks = { findByIdWithTags: jest.fn() };
  const comments = { findById: jest.fn() };

  let consumer: RealtimeEventConsumer;
  let rooms: { fetchSockets: jest.Mock; emit: jest.Mock };
  let server: { in: jest.Mock; to: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RealtimeEventConsumer,
        { provide: TaskEventBus, useValue: eventBus },
        { provide: TaskRepository, useValue: tasks },
        { provide: CommentRepository, useValue: comments },
        { provide: LoggerService, useValue: logger },
      ],
    }).compile();
    await moduleRef.init();
    consumer = moduleRef.get(RealtimeEventConsumer);

    rooms = { fetchSockets: jest.fn().mockResolvedValue([]), emit: jest.fn() };
    server = {
      in: jest.fn().mockReturnValue(rooms),
      to: jest.fn().mockReturnValue(rooms),
    };
  });

  function bindServer(): void {
    consumer.bindServer(server as unknown as Server);
  }

  it('registers itself as a task event consumer on init', () => {
    expect(eventBus.register).toHaveBeenCalledWith(consumer);
  });

  describe('task state events (created/updated/completed/reopened)', () => {
    it.each([
      TaskEventType.TASK_CREATED,
      TaskEventType.TASK_UPDATED,
      TaskEventType.TASK_COMPLETED,
      TaskEventType.TASK_REOPENED,
    ])(
      'routes %s to the team room with the reconstructed task',
      async (type) => {
        bindServer();
        tasks.findByIdWithTags.mockResolvedValue(taskEntity);

        await consumer.handle(
          makeEvent(type, { teamId: TEAM_ID, taskId: TASK_ID }),
        );

        expect(server.to).toHaveBeenCalledWith(teamRoom(TEAM_ID));
        expect(rooms.emit).toHaveBeenCalledWith(type, {
          eventId: EVENT_ID,
          occurredAt: '2026-01-01T00:00:00.000Z',
          actor: { userId: ACTOR },
          payload: {
            task: expect.objectContaining({ id: TASK_ID, title: 'Buy milk' }),
          },
        });
      },
    );

    it('routes a personal task event to the actor user room', async () => {
      bindServer();
      tasks.findByIdWithTags.mockResolvedValue({
        ...taskEntity,
        teamId: null,
      });

      await consumer.handle(
        makeEvent(TaskEventType.TASK_UPDATED, { taskId: TASK_ID }),
      );

      expect(server.to).toHaveBeenCalledWith(userRoom(ACTOR));
      expect(rooms.emit).toHaveBeenCalledWith(
        REALTIME_EVENTS.TASK_UPDATED,
        expect.objectContaining({
          actor: { userId: ACTOR },
        }),
      );
    });

    it('drops the event when the task row is gone', async () => {
      bindServer();
      tasks.findByIdWithTags.mockResolvedValue(null);

      await consumer.handle(
        makeEvent(TaskEventType.TASK_UPDATED, { taskId: TASK_ID }),
      );

      expect(rooms.emit).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('realtime_task_missing', {
        eventId: EVENT_ID,
        taskId: TASK_ID,
      });
    });

    it('does nothing when the server is not bound', async () => {
      await consumer.handle(
        makeEvent(TaskEventType.TASK_CREATED, { teamId: TEAM_ID }),
      );
      expect(tasks.findByIdWithTags).not.toHaveBeenCalled();
    });
  });

  describe('task.deleted', () => {
    it('emits the event-carried payload without a fetch', () => {
      bindServer();
      const event = makeEvent(TaskEventType.TASK_DELETED, {
        teamId: TEAM_ID,
        taskId: TASK_ID,
        data: { title: 'Buy milk' },
      });

      consumer.handle(event);

      expect(tasks.findByIdWithTags).not.toHaveBeenCalled();
      expect(server.to).toHaveBeenCalledWith(teamRoom(TEAM_ID));
      expect(rooms.emit).toHaveBeenCalledWith(REALTIME_EVENTS.TASK_DELETED, {
        eventId: EVENT_ID,
        occurredAt: '2026-01-01T00:00:00.000Z',
        actor: { userId: ACTOR },
        payload: { taskId: TASK_ID, title: 'Buy milk', teamId: TEAM_ID },
      });
    });
  });

  describe('comment.added', () => {
    it('routes to the task team room with the commenter as actor', async () => {
      bindServer();
      comments.findById.mockResolvedValue(commentEntity);

      await consumer.handle(
        makeEvent(TaskEventType.COMMENT_ADDED, {
          teamId: TEAM_ID,
          taskId: TASK_ID,
          data: { title: 'Buy milk', commentId: COMMENT_ID },
        }),
      );

      expect(server.to).toHaveBeenCalledWith(teamRoom(TEAM_ID));
      expect(rooms.emit).toHaveBeenCalledWith(REALTIME_EVENTS.COMMENT_ADDED, {
        eventId: EVENT_ID,
        occurredAt: '2026-01-01T00:00:00.000Z',
        actor: { userId: ACTOR },
        payload: {
          comment: expect.objectContaining({
            id: COMMENT_ID,
            body: 'Looks good',
          }),
          task: { id: TASK_ID, title: 'Buy milk' },
        },
      });
    });

    it('drops the event when the comment row is gone', async () => {
      bindServer();
      comments.findById.mockResolvedValue(null);

      await consumer.handle(
        makeEvent(TaskEventType.COMMENT_ADDED, {
          teamId: TEAM_ID,
          data: { commentId: COMMENT_ID },
        }),
      );

      expect(rooms.emit).not.toHaveBeenCalled();
    });
  });

  describe('invitation.accepted', () => {
    it('routes to the team room', () => {
      bindServer();

      consumer.handle(
        makeEvent(TaskEventType.INVITATION_ACCEPTED, {
          teamId: TEAM_ID,
          data: { invitedEmail: 'invitee@example.com' },
        }),
      );

      expect(server.to).toHaveBeenCalledWith(teamRoom(TEAM_ID));
      expect(rooms.emit).toHaveBeenCalledWith(
        REALTIME_EVENTS.INVITATION_ACCEPTED,
        {
          eventId: EVENT_ID,
          occurredAt: '2026-01-01T00:00:00.000Z',
          actor: { userId: ACTOR },
          payload: {
            teamId: TEAM_ID,
            invitedEmail: 'invitee@example.com',
            invitedBy: { userId: ACTOR },
          },
        },
      );
    });
  });

  describe('member.removed', () => {
    it('force-leaves the removed user sockets and broadcasts to the team', async () => {
      bindServer();
      const removedSocket = { leave: jest.fn() };
      rooms.fetchSockets.mockResolvedValue([removedSocket]);

      await consumer.handle(
        makeEvent(TaskEventType.MEMBER_REMOVED, {
          userId: REMOVED,
          teamId: TEAM_ID,
        }),
      );

      expect(server.in).toHaveBeenCalledWith(userRoom(REMOVED));
      expect(removedSocket.leave).toHaveBeenCalledWith(teamRoom(TEAM_ID));
      expect(server.to).toHaveBeenCalledWith(teamRoom(TEAM_ID));
      expect(rooms.emit).toHaveBeenCalledWith(REALTIME_EVENTS.MEMBER_REMOVED, {
        eventId: EVENT_ID,
        occurredAt: '2026-01-01T00:00:00.000Z',
        payload: { teamId: TEAM_ID, userId: REMOVED },
      });
    });

    it('does nothing when the event has no team scope', async () => {
      bindServer();
      await consumer.handle(makeEvent(TaskEventType.MEMBER_REMOVED));
      expect(server.in).not.toHaveBeenCalled();
      expect(server.to).not.toHaveBeenCalled();
    });
  });

  describe('sessions.revoked', () => {
    it('disconnects every socket of the user with an auth_error', async () => {
      bindServer();
      const socket = { emit: jest.fn(), disconnect: jest.fn() };
      rooms.fetchSockets.mockResolvedValue([socket]);

      await consumer.handle(
        makeEvent(TaskEventType.SESSIONS_REVOKED, { userId: REMOVED }),
      );

      expect(server.in).toHaveBeenCalledWith(userRoom(REMOVED));
      expect(socket.emit).toHaveBeenCalledWith(REALTIME_EVENTS.AUTH_ERROR, {
        code: 'SESSION_REVOKED',
        message: 'Your session has been revoked',
      });
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(server.to).not.toHaveBeenCalled();
    });

    it('does nothing when the user has no live sockets', async () => {
      bindServer();
      rooms.fetchSockets.mockResolvedValue([]);

      await consumer.handle(
        makeEvent(TaskEventType.SESSIONS_REVOKED, { userId: REMOVED }),
      );

      expect(rooms.emit).not.toHaveBeenCalled();
    });
  });

  it('skips TASK_ASSIGNED and USER_ROLE_CHANGED without emitting', async () => {
    bindServer();
    await consumer.handle(makeEvent(TaskEventType.TASK_ASSIGNED));
    await consumer.handle(makeEvent(TaskEventType.USER_ROLE_CHANGED));
    expect(tasks.findByIdWithTags).not.toHaveBeenCalled();
    expect(server.to).not.toHaveBeenCalled();
    expect(rooms.emit).not.toHaveBeenCalled();
  });
});
