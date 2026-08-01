import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { LoggerService } from '../../common/logger/logger.service';
import { QueueService } from '../queue/queue.service';
import { TASKO_QUEUE, TASK_EVENT_JOB } from '../queue/queue.constants';
import { JobHandlerRegistry } from './job-handler-registry.service';
import { TaskEvent, TaskEventType } from './task-event';
import { TaskEventBus } from './task-event-bus.service';

const EVENT: TaskEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  type: TaskEventType.TASK_CREATED,
  userId: '22222222-2222-4222-8222-222222222222',
  taskId: '33333333-3333-4333-8333-333333333333',
  occurredAt: '2026-01-01T00:00:00.000Z',
  data: { title: 'Buy milk' },
};

describe('TaskEventBus', () => {
  const queueService = { isEnabled: jest.fn() };
  const queue = { add: jest.fn() };
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

  let bus: TaskEventBus;
  let registry: JobHandlerRegistry;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TaskEventBus,
        JobHandlerRegistry,
        { provide: QueueService, useValue: queueService },
        { provide: LoggerService, useValue: logger },
        { provide: getQueueToken(TASKO_QUEUE), useValue: queue },
      ],
    }).compile();
    await moduleRef.init();
    bus = moduleRef.get(TaskEventBus);
    registry = moduleRef.get(JobHandlerRegistry);
  });

  describe('publish', () => {
    it('enqueues a retryable job when the queue is enabled', async () => {
      queueService.isEnabled.mockReturnValue(true);

      await bus.publish(EVENT);

      expect(queue.add).toHaveBeenCalledWith(
        TASK_EVENT_JOB,
        EVENT,
        expect.objectContaining({
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
        }),
      );
    });

    it('dispatches in-process when the queue is disabled', async () => {
      queueService.isEnabled.mockReturnValue(false);
      const consumer = { handle: jest.fn().mockResolvedValue(undefined) };
      bus.register(consumer);

      await bus.publish(EVENT);

      expect(queue.add).not.toHaveBeenCalled();
      expect(consumer.handle).toHaveBeenCalledWith(EVENT);
    });

    it('swallows enqueue failures so producers are never broken', async () => {
      queueService.isEnabled.mockReturnValue(true);
      queue.add.mockRejectedValue(new Error('redis down'));

      await expect(bus.publish(EVENT)).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('dispatch', () => {
    it('delivers to every registered consumer', async () => {
      const a = { handle: jest.fn().mockResolvedValue(undefined) };
      const b = { handle: jest.fn().mockResolvedValue(undefined) };
      bus.register(a);
      bus.register(b);

      await bus.dispatch(EVENT);

      expect(a.handle).toHaveBeenCalledWith(EVENT);
      expect(b.handle).toHaveBeenCalledWith(EVENT);
    });

    it('keeps delivering to remaining consumers when one throws', async () => {
      const failing = {
        handle: jest.fn().mockRejectedValue(new Error('boom')),
      };
      const healthy = { handle: jest.fn().mockResolvedValue(undefined) };
      bus.register(failing);
      bus.register(healthy);

      await expect(bus.dispatch(EVENT)).resolves.toBeUndefined();
      expect(healthy.handle).toHaveBeenCalledWith(EVENT);
      expect(logger.error).toHaveBeenCalled();
    });

    it('ignores unregistered consumers after unregister', async () => {
      const consumer = { handle: jest.fn().mockResolvedValue(undefined) };
      bus.register(consumer);
      bus.unregister(consumer);

      await bus.dispatch(EVENT);

      expect(consumer.handle).not.toHaveBeenCalled();
    });
  });

  describe('queue wiring', () => {
    it('registers a task-event job handler in the registry on init', () => {
      const handler = registry.get(TASK_EVENT_JOB);
      expect(handler).toBeDefined();
      expect(handler?.name).toBe(TASK_EVENT_JOB);
    });
  });
});
