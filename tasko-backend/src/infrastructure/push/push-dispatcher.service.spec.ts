import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { LoggerService } from '../../common/logger/logger.service';
import { QueueService } from '../queue/queue.service';
import { PUSH_JOB, TASKO_QUEUE } from '../queue/queue.constants';
import { PushDispatcher } from './push-dispatcher.service';
import { PushMessage, PushService } from './push.service';

const MESSAGE: PushMessage = {
  deviceTokens: ['device-token-a'],
  title: 'Task created',
  body: '"Buy milk" was added.',
  data: {
    notificationId: '11111111-1111-4111-8111-111111111111',
    taskId: '22222222-2222-4222-8222-222222222222',
  },
};

describe('PushDispatcher', () => {
  const queueService = { isEnabled: jest.fn() };
  const queue = { add: jest.fn() };
  const pushService = { send: jest.fn() };
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

  let dispatcher: PushDispatcher;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PushDispatcher,
        { provide: QueueService, useValue: queueService },
        { provide: PushService, useValue: pushService },
        { provide: getQueueToken(TASKO_QUEUE), useValue: queue },
        { provide: LoggerService, useValue: logger },
      ],
    }).compile();
    dispatcher = moduleRef.get(PushDispatcher);
  });

  it('enqueues a retryable push job when the queue is enabled', async () => {
    queueService.isEnabled.mockReturnValue(true);

    await dispatcher.dispatch(MESSAGE);

    expect(queue.add).toHaveBeenCalledWith(
      PUSH_JOB,
      MESSAGE,
      expect.objectContaining({
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      }),
    );
    expect(pushService.send).not.toHaveBeenCalled();
  });

  it('sends synchronously as a fallback when the queue is disabled', async () => {
    queueService.isEnabled.mockReturnValue(false);

    await dispatcher.dispatch(MESSAGE);

    expect(pushService.send).toHaveBeenCalledWith(MESSAGE);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('swallows dispatch failures so notification writes never fail', async () => {
    queueService.isEnabled.mockReturnValue(true);
    queue.add.mockRejectedValue(new Error('redis down'));

    await expect(dispatcher.dispatch(MESSAGE)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
