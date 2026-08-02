import { Test } from '@nestjs/testing';
import { TaskPriority } from '../../../common/constants/task-priority.enum';
import { TaskRepository } from '../interfaces/task-repository';
import { TaskQueryService } from './task-query.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const TEAM = '99999999-9999-4999-8999-999999999999';
const OTHER_TEAM = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('TaskQueryService', () => {
  const tasks = {
    findById: jest.fn(),
    findByIdWithTags: jest.fn(),
    listAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  let service: TaskQueryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TaskQueryService,
        { provide: TaskRepository, useValue: tasks },
      ],
    }).compile();
    service = moduleRef.get(TaskQueryService);
  });

  const task = {
    id: '66666666-6666-4666-8666-666666666666',
    userId: OWNER,
    teamId: null,
    title: 'Buy milk',
    time: '06:30 AM',
    date: 'today',
    isDone: false,
    priority: TaskPriority.MEDIUM,
    notes: null,
    categoryId: null,
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('list', () => {
    it('paginates and maps the result', async () => {
      tasks.listAndCount.mockResolvedValue([[task], 1]);
      const result = await service.list(OWNER, { page: 1, limit: 20 });
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.items[0].id).toBe(task.id);
    });

    it('resolves a today filter into label + iso and passes it through', async () => {
      tasks.listAndCount.mockResolvedValue([[task], 1]);
      await service.list(OWNER, { date: 'today', page: 1, limit: 20 });
      const options = tasks.listAndCount.mock.calls[0][0];
      expect(options.relativeLabel).toBe('today');
      expect(options.relativeIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('parses the isDone query string into a boolean', async () => {
      tasks.listAndCount.mockResolvedValue([[], 0]);
      await service.list(OWNER, { isDone: 'true', page: 1, limit: 20 });
      expect(tasks.listAndCount.mock.calls[0][0].isDone).toBe(true);
    });

    it('defaults sort and trims the free-text query', async () => {
      tasks.listAndCount.mockResolvedValue([[], 0]);
      await service.list(OWNER, { query: '  milk  ', page: 2, limit: 10 });
      const options = tasks.listAndCount.mock.calls[0][0];
      expect(options.sortBy).toBe('createdAt');
      expect(options.sortDir).toBe('ASC');
      expect(options.query).toBe('milk');
      expect(options.page).toBe(2);
    });
  });

  describe('get', () => {
    it('returns an owned task', async () => {
      tasks.findByIdWithTags.mockResolvedValue(task);
      await expect(service.get(OWNER, task.id)).resolves.toMatchObject({
        title: 'Buy milk',
      });
    });

    it('hides another users task as not found', async () => {
      tasks.findByIdWithTags.mockResolvedValue(task);
      await expect(service.get(OTHER, task.id)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
    });

    it('hides a team task from a personal get', async () => {
      tasks.findByIdWithTags.mockResolvedValue({ ...task, teamId: TEAM });
      await expect(service.get(OWNER, task.id)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
    });

    it('returns not found for a missing task', async () => {
      tasks.findByIdWithTags.mockResolvedValue(null);
      await expect(service.get(OWNER, task.id)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
    });
  });

  describe('team-scoped reads', () => {
    const teamTask = { ...task, teamId: TEAM };

    it('lists every task in a team', async () => {
      tasks.listAndCount.mockResolvedValue([[teamTask], 1]);
      const result = await service.listForTeam(TEAM, { page: 1, limit: 20 });
      expect(tasks.listAndCount.mock.calls[0][0].teamId).toBe(TEAM);
      expect(result.total).toBe(1);
      expect(result.items[0].teamId).toBe(TEAM);
    });

    it('gets a team task within the team', async () => {
      tasks.findByIdWithTags.mockResolvedValue(teamTask);
      await expect(service.getTeam(TEAM, task.id)).resolves.toMatchObject({
        title: 'Buy milk',
        teamId: TEAM,
      });
    });

    it('hides a personal task from a team get', async () => {
      tasks.findByIdWithTags.mockResolvedValue(task);
      await expect(service.getTeam(TEAM, task.id)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
    });

    it('hides a task from another team as not found', async () => {
      tasks.findByIdWithTags.mockResolvedValue(teamTask);
      await expect(service.getTeam(OTHER_TEAM, task.id)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
    });
  });
});
