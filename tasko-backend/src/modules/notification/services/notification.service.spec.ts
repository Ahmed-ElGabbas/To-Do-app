import { Test } from '@nestjs/testing';
import { ResourceNotFoundError } from '../../../common/errors/domain-error';
import { LoggerService } from '../../../common/logger/logger.service';
import {
  TaskEvent,
  TaskEventType,
} from '../../../infrastructure/events/task-event';
import { TaskEventBus } from '../../../infrastructure/events/task-event-bus.service';
import { PushDispatcher } from '../../../infrastructure/push/push-dispatcher.service';
import { PresenceRegistry } from '../../realtime/interfaces/presence-registry';
import { NotificationType } from '../constants/notification-type.enum';
import { DeviceTokenRepository } from '../interfaces/device-token-repository';
import { NotificationRepository } from '../interfaces/notification-repository';
import { NotificationService } from './notification.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const TASK = '22222222-2222-4222-8222-222222222222';
const EVENT_ID = '33333333-3333-4333-8333-333333333333';

function makeEvent(
  type: TaskEventType,
  overrides: Partial<TaskEvent> = {},
): TaskEvent {
  return {
    id: EVENT_ID,
    type,
    userId: OWNER,
    taskId: TASK,
    occurredAt: '2026-01-01T00:00:00.000Z',
    data: { title: 'Buy milk' },
    ...overrides,
  };
}

const baseNotification = {
  id: '44444444-4444-4444-8444-444444444444',
  userId: OWNER,
  eventId: EVENT_ID,
  type: NotificationType.TASK_CREATED,
  title: 'Task created',
  body: '"Buy milk" was added.',
  data: { taskId: TASK },
  isRead: false,
  readAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('NotificationService', () => {
  const notifications = {
    findByEventId: jest.fn(),
    findByIdAndUser: jest.fn(),
    listAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    markAllRead: jest.fn(),
  };
  const devices = {
    findByToken: jest.fn(),
    findByUser: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const pushDispatcher = { dispatch: jest.fn() };
  const eventBus = { register: jest.fn() };
  const presence = { isUserOnline: jest.fn() };
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

  let service: NotificationService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: NotificationRepository, useValue: notifications },
        { provide: DeviceTokenRepository, useValue: devices },
        { provide: PushDispatcher, useValue: pushDispatcher },
        { provide: TaskEventBus, useValue: eventBus },
        { provide: PresenceRegistry, useValue: presence },
        { provide: LoggerService, useValue: logger },
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(NotificationService);
  });

  it('registers itself as a task event consumer on init', () => {
    expect(eventBus.register).toHaveBeenCalledWith(service);
  });

  describe('handle (event consumer)', () => {
    it('creates a notification and pushes to every device', async () => {
      notifications.findByEventId.mockResolvedValue(null);
      notifications.create.mockResolvedValue(baseNotification);
      devices.findByUser.mockResolvedValue([
        { id: 'd1', token: 'tok-a' },
        { id: 'd2', token: 'tok-b' },
      ]);
      presence.isUserOnline.mockReturnValue(false);

      await service.handle(makeEvent(TaskEventType.TASK_CREATED));

      expect(notifications.create).toHaveBeenCalledWith({
        userId: OWNER,
        eventId: EVENT_ID,
        type: NotificationType.TASK_CREATED,
        title: 'Task created',
        body: '"Buy milk" was added.',
        data: { taskId: TASK },
      });
      expect(pushDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceTokens: ['tok-a', 'tok-b'],
          title: 'Task created',
          body: '"Buy milk" was added.',
          data: {
            notificationId: baseNotification.id,
            taskId: TASK,
          },
        }),
      );
    });

    it('skips replayed events (dedupe by eventId)', async () => {
      notifications.findByEventId.mockResolvedValue(baseNotification);

      await service.handle(makeEvent(TaskEventType.TASK_CREATED));

      expect(notifications.create).not.toHaveBeenCalled();
      expect(pushDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('persists without pushing when the user has no devices', async () => {
      notifications.findByEventId.mockResolvedValue(null);
      notifications.create.mockResolvedValue(baseNotification);
      devices.findByUser.mockResolvedValue([]);

      await service.handle(makeEvent(TaskEventType.TASK_UPDATED));

      expect(notifications.create).toHaveBeenCalledTimes(1);
      expect(pushDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('writes the row but suppresses the push when the user is online', async () => {
      notifications.findByEventId.mockResolvedValue(null);
      notifications.create.mockResolvedValue(baseNotification);
      devices.findByUser.mockResolvedValue([
        { id: 'd1', token: 'tok-a' },
        { id: 'd2', token: 'tok-b' },
      ]);
      presence.isUserOnline.mockReturnValue(true);

      await service.handle(makeEvent(TaskEventType.TASK_CREATED));

      expect(presence.isUserOnline).toHaveBeenCalledWith(OWNER);
      expect(notifications.create).toHaveBeenCalledTimes(1);
      expect(pushDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('maps each event type to the matching template', async () => {
      notifications.findByEventId.mockResolvedValue(null);
      notifications.create.mockImplementation((data) =>
        Promise.resolve({ ...baseNotification, ...data }),
      );
      devices.findByUser.mockResolvedValue([]);

      await service.handle(makeEvent(TaskEventType.TASK_COMPLETED));
      await service.handle(makeEvent(TaskEventType.TASK_REOPENED));
      await service.handle(makeEvent(TaskEventType.TASK_DELETED));

      const created = notifications.create.mock.calls.map((call) => call[0]);
      expect(created).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: NotificationType.TASK_COMPLETED,
            body: '"Buy milk" was completed.',
          }),
          expect.objectContaining({
            type: NotificationType.TASK_REOPENED,
            body: '"Buy milk" was reopened.',
          }),
          expect.objectContaining({
            type: NotificationType.TASK_DELETED,
            body: '"Buy milk" was deleted.',
          }),
        ]),
      );
    });

    it('maps comment, invitation and assignment events', async () => {
      notifications.findByEventId.mockResolvedValue(null);
      notifications.create.mockImplementation((data) =>
        Promise.resolve({ ...baseNotification, ...data }),
      );
      devices.findByUser.mockResolvedValue([]);

      await service.handle(
        makeEvent(TaskEventType.COMMENT_ADDED, {
          data: { title: 'Buy milk', commentId: 'c1' },
        }),
      );
      await service.handle(
        makeEvent(TaskEventType.INVITATION_ACCEPTED, {
          userId: OWNER,
          taskId: undefined,
          data: { invitedEmail: 'guest@example.com' },
        }),
      );
      await service.handle(makeEvent(TaskEventType.TASK_ASSIGNED));

      const created = notifications.create.mock.calls.map((call) => call[0]);
      expect(created).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: NotificationType.COMMENT_ADDED,
            title: 'New comment',
            body: '"Buy milk" has a new comment.',
            data: { taskId: TASK, commentId: 'c1' },
          }),
          expect.objectContaining({
            type: NotificationType.INVITATION_ACCEPTED,
            title: 'Invitation accepted',
            body: 'guest@example.com accepted your team invitation.',
            data: { invitedEmail: 'guest@example.com' },
          }),
          expect.objectContaining({
            type: NotificationType.TASK_ASSIGNED,
            title: 'Task assigned',
            body: '"Buy milk" was assigned to your team.',
          }),
        ]),
      );
    });

    it('omits the taskId from push data when the event has none', async () => {
      notifications.findByEventId.mockResolvedValue(null);
      notifications.create.mockResolvedValue(baseNotification);
      devices.findByUser.mockResolvedValue([{ id: 'd1', token: 'tok-a' }]);

      await service.handle(
        makeEvent(TaskEventType.INVITATION_ACCEPTED, {
          taskId: undefined,
          data: { invitedEmail: 'guest@example.com' },
        }),
      );

      expect(pushDispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { notificationId: baseNotification.id },
        }),
      );
    });
  });

  describe('list', () => {
    it('returns a paginated, filterable result', async () => {
      notifications.listAndCount.mockResolvedValue([
        [{ ...baseNotification }],
        1,
      ]);

      const result = await service.list(OWNER, {
        page: 2,
        limit: 10,
        isRead: 'false',
      });

      expect(notifications.listAndCount).toHaveBeenCalledWith(OWNER, {
        page: 2,
        limit: 10,
        isRead: false,
      });
      expect(result).toEqual({
        items: [expect.objectContaining({ id: baseNotification.id })],
        page: 2,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('markRead', () => {
    it('marks an unread notification as read', async () => {
      notifications.findByIdAndUser.mockResolvedValue(baseNotification);
      notifications.save.mockImplementation((entity) =>
        Promise.resolve({ ...entity, isRead: true, readAt: expect.any(Date) }),
      );

      const result = await service.markRead(OWNER, baseNotification.id);

      expect(notifications.save).toHaveBeenCalledTimes(1);
      expect(result.isRead).toBe(true);
      expect(result.readAt).toBeDefined();
    });

    it('returns the notification untouched when already read', async () => {
      notifications.findByIdAndUser.mockResolvedValue({
        ...baseNotification,
        isRead: true,
        readAt: new Date(),
      });

      const result = await service.markRead(OWNER, baseNotification.id);

      expect(notifications.save).not.toHaveBeenCalled();
      expect(result.isRead).toBe(true);
    });

    it('throws ResourceNotFoundError for a missing or foreign notification', async () => {
      notifications.findByIdAndUser.mockResolvedValue(null);
      await expect(
        service.markRead(OWNER, baseNotification.id),
      ).rejects.toBeInstanceOf(ResourceNotFoundError);
    });
  });

  describe('markAllRead', () => {
    it('returns the number of updated notifications', async () => {
      notifications.markAllRead.mockResolvedValue(3);

      await expect(service.markAllRead(OWNER)).resolves.toEqual({ updated: 3 });
      expect(notifications.markAllRead).toHaveBeenCalledWith(OWNER);
    });
  });
});
