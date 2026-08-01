import { Test } from '@nestjs/testing';
import { LoggerService } from '../../../common/logger/logger.service';
import {
  TaskEvent,
  TaskEventType,
} from '../../../infrastructure/events/task-event';
import { TaskEventBus } from '../../../infrastructure/events/task-event-bus.service';
import { ActivityLogRepository } from '../interfaces/activity-log-repository';
import { ActivityLogService } from './activity-log.service';

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

const baseLog = {
  id: '44444444-4444-4444-8444-444444444444',
  userId: OWNER,
  eventId: EVENT_ID,
  type: TaskEventType.TASK_CREATED,
  entityId: TASK,
  summary: 'Task created: "Buy milk"',
  metadata: null,
  createdAt: new Date(),
};

describe('ActivityLogService', () => {
  const logs = {
    findByEventId: jest.fn(),
    listAndCount: jest.fn(),
    create: jest.fn(),
  };
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

  let service: ActivityLogService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ActivityLogService,
        { provide: ActivityLogRepository, useValue: logs },
        { provide: TaskEventBus, useValue: eventBus },
        { provide: LoggerService, useValue: logger },
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(ActivityLogService);
  });

  it('registers itself as a task event consumer on init', () => {
    expect(eventBus.register).toHaveBeenCalledWith(service);
  });

  describe('handle (event consumer)', () => {
    it('appends an immutable activity record', async () => {
      logs.findByEventId.mockResolvedValue(null);
      logs.create.mockResolvedValue(baseLog);

      await service.handle(makeEvent(TaskEventType.TASK_CREATED));

      expect(logs.create).toHaveBeenCalledWith({
        userId: OWNER,
        eventId: EVENT_ID,
        type: TaskEventType.TASK_CREATED,
        entityId: TASK,
        summary: 'Task created: "Buy milk"',
        metadata: {
          occurredAt: '2026-01-01T00:00:00.000Z',
          data: { title: 'Buy milk' },
        },
      });
    });

    it('skips replayed events (dedupe by eventId)', async () => {
      logs.findByEventId.mockResolvedValue(baseLog);

      await service.handle(makeEvent(TaskEventType.TASK_UPDATED));

      expect(logs.create).not.toHaveBeenCalled();
    });

    it('summarizes every event type', async () => {
      logs.findByEventId.mockResolvedValue(null);
      logs.create.mockImplementation((data) =>
        Promise.resolve({ ...baseLog, ...data }),
      );

      const cases: Array<[TaskEventType, string]> = [
        [TaskEventType.TASK_CREATED, 'Task created: "Buy milk"'],
        [TaskEventType.TASK_UPDATED, 'Task updated: "Buy milk"'],
        [TaskEventType.TASK_COMPLETED, 'Task completed: "Buy milk"'],
        [TaskEventType.TASK_REOPENED, 'Task reopened: "Buy milk"'],
        [TaskEventType.TASK_DELETED, 'Task deleted: "Buy milk"'],
      ];

      for (const [type, summary] of cases) {
        await service.handle(makeEvent(type));
        expect(logs.create).toHaveBeenCalledWith(
          expect.objectContaining({ type, summary }),
        );
      }
    });
  });
});
