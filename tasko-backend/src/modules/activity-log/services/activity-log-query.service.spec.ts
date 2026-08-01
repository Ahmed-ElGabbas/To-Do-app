import { Test } from '@nestjs/testing';
import { TaskEventType } from '../../../infrastructure/events/task-event';
import { ActivityLogRepository } from '../interfaces/activity-log-repository';
import { ActivityLogQueryService } from './activity-log-query.service';

const OWNER = '11111111-1111-4111-8111-111111111111';

const baseLog = {
  id: '33333333-3333-4333-8333-333333333333',
  userId: OWNER,
  eventId: '44444444-4444-4444-8444-444444444444',
  type: TaskEventType.TASK_CREATED,
  entityId: '55555555-5555-4555-8555-555555555555',
  summary: 'Task created: "Buy milk"',
  metadata: null,
  createdAt: new Date(),
};

describe('ActivityLogQueryService', () => {
  const logs = {
    findByEventId: jest.fn(),
    listAndCount: jest.fn(),
    create: jest.fn(),
  };

  let service: ActivityLogQueryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ActivityLogQueryService,
        { provide: ActivityLogRepository, useValue: logs },
      ],
    }).compile();
    service = moduleRef.get(ActivityLogQueryService);
  });

  it('returns a paginated feed for the caller', async () => {
    logs.listAndCount.mockResolvedValue([[baseLog], 1]);

    const result = await service.list(OWNER, { page: 1, limit: 20 });

    expect(logs.listAndCount).toHaveBeenCalledWith(OWNER, {
      page: 1,
      limit: 20,
      type: undefined,
    });
    expect(result).toEqual({
      items: [expect.objectContaining({ summary: 'Task created: "Buy milk"' })],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it('forwards the type filter when provided', async () => {
    logs.listAndCount.mockResolvedValue([[], 0]);

    await service.list(OWNER, {
      page: 1,
      limit: 20,
      type: TaskEventType.TASK_COMPLETED,
    });

    expect(logs.listAndCount).toHaveBeenCalledWith(OWNER, {
      page: 1,
      limit: 20,
      type: TaskEventType.TASK_COMPLETED,
    });
  });

  it('applies defaults when no pagination is supplied', async () => {
    logs.listAndCount.mockResolvedValue([[], 0]);

    await service.list(OWNER, {});

    expect(logs.listAndCount).toHaveBeenCalledWith(OWNER, {
      page: 1,
      limit: 20,
      type: undefined,
    });
  });
});
