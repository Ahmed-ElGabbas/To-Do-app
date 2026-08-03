import { Test } from '@nestjs/testing';
import { TaskPriority } from '../../../common/constants/task-priority.enum';
import {
  AnalyticsRow,
  TaskRepository,
} from '../../task/interfaces/task-repository';
import { AnalyticsService } from './analytics.service';

const USER = '11111111-1111-4111-8111-111111111111';
const TEAM = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CATEGORY = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function row(overrides: Partial<AnalyticsRow>): AnalyticsRow {
  return {
    id: 't1',
    isDone: false,
    priority: TaskPriority.MEDIUM,
    date: 'today',
    categoryId: null,
    categoryName: null,
    completedAt: null,
    ...overrides,
  };
}

describe('AnalyticsService', () => {
  const tasks = { listForAnalytics: jest.fn() };
  let service: AnalyticsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: TaskRepository, useValue: tasks },
      ],
    }).compile();
    service = moduleRef.get(AnalyticsService);
  });

  it('computes totals, completion rate, and priority breakdown', async () => {
    tasks.listForAnalytics.mockResolvedValue([
      row({ priority: TaskPriority.HIGH, isDone: true }),
      row({ priority: TaskPriority.HIGH, isDone: false }),
      row({ priority: TaskPriority.LOW, isDone: false }),
    ]);

    const result = await service.personal(USER);

    expect(tasks.listForAnalytics).toHaveBeenCalledWith({ userId: USER });
    expect(result.total).toBe(3);
    expect(result.completed).toBe(1);
    expect(result.pending).toBe(2);
    expect(result.completionRate).toBe(33.3);
    expect(result.byPriority).toEqual({ high: 2, medium: 0, low: 1 });
  });

  it('returns a zero completion rate for an empty scope', async () => {
    tasks.listForAnalytics.mockResolvedValue([]);
    const result = await service.personal(USER);
    expect(result.completionRate).toBe(0);
    expect(result.total).toBe(0);
  });

  it('counts overdue tasks as not-done ISO dates before today', async () => {
    tasks.listForAnalytics.mockResolvedValue([
      row({ date: '2000-01-01', isDone: false }),
      row({ date: '2000-01-01', isDone: true }),
      row({ date: 'today', isDone: false }),
      row({ date: 'tomorrow', isDone: false }),
    ]);

    const result = await service.personal(USER);
    expect(result.overdue).toBe(1);
  });

  it('breaks totals and completions down by category', async () => {
    tasks.listForAnalytics.mockResolvedValue([
      row({ categoryId: CATEGORY, categoryName: 'Work', isDone: true }),
      row({ categoryId: CATEGORY, categoryName: 'Work', isDone: false }),
      row({ categoryId: null, categoryName: null, isDone: false }),
    ]);

    const result = await service.personal(USER);
    expect(result.byCategory).toEqual([
      { categoryId: CATEGORY, name: 'Work', total: 2, completed: 1 },
      { categoryId: null, name: null, total: 1, completed: 0 },
    ]);
  });

  it('builds a 7-day completion trend with fixed point-in-time dates', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-03T10:00:00'));
    try {
      tasks.listForAnalytics.mockResolvedValue([
        row({
          isDone: true,
          completedAt: new Date('2026-08-03T08:00:00'),
        }),
        row({
          isDone: true,
          completedAt: new Date('2026-08-01T09:00:00'),
        }),
        row({ isDone: false }),
      ]);

      const result = await service.personal(USER);

      expect(result.completionTrend).toEqual([
        { date: '2026-07-28', completed: 0 },
        { date: '2026-07-29', completed: 0 },
        { date: '2026-07-30', completed: 0 },
        { date: '2026-07-31', completed: 0 },
        { date: '2026-08-01', completed: 1 },
        { date: '2026-08-02', completed: 0 },
        { date: '2026-08-03', completed: 1 },
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('computes team analytics with the same summary', async () => {
    tasks.listForAnalytics.mockResolvedValue([
      row({ isDone: true }),
      row({ isDone: false }),
    ]);

    const result = await service.team(TEAM);

    expect(tasks.listForAnalytics).toHaveBeenCalledWith({ teamId: TEAM });
    expect(result.total).toBe(2);
    expect(result.completed).toBe(1);
    expect(result.completionRate).toBe(50);
  });
});
