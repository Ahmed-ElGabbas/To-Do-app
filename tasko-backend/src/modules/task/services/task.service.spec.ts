import { Test } from '@nestjs/testing';
import { TaskPriority } from '../../../common/constants/task-priority.enum';
import { TaskEventType } from '../../../infrastructure/events/task-event';
import { TaskEventBus } from '../../../infrastructure/events/task-event-bus.service';
import { CategoryRepository } from '../../category/interfaces/category-repository';
import { MemberRepository } from '../../member/interfaces/member-repository';
import { TagRepository } from '../../tag/interfaces/tag-repository';
import { TaskRepository } from '../interfaces/task-repository';
import { TaskQueryService } from './task-query.service';
import { TaskService } from './task.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const TEAM = '99999999-9999-4999-8999-999999999999';
const CATEGORY = '33333333-3333-4333-8333-333333333333';
const TAG_A = '44444444-4444-4444-8444-444444444444';
const TAG_B = '55555555-5555-4555-8555-555555555555';

describe('TaskService', () => {
  const tasks = {
    findById: jest.fn(),
    findByIdWithTags: jest.fn(),
    listAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const categories = {
    findById: jest.fn(),
    findByNameForUser: jest.fn(),
    listByUser: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const tags = {
    findById: jest.fn(),
    findByNameForUser: jest.fn(),
    listByUser: jest.fn(),
    findByIdsForUser: jest.fn(),
    findByIdsForTeam: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const taskQuery = {
    getOwnedTask: jest.fn(),
    getTeamTask: jest.fn(),
  };
  const eventBus = {
    publish: jest.fn(),
  };
  const members = {
    listByTeam: jest.fn(),
  };

  let service: TaskService;

  beforeEach(async () => {
    jest.clearAllMocks();
    members.listByTeam.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: TaskRepository, useValue: tasks },
        { provide: CategoryRepository, useValue: categories },
        { provide: TagRepository, useValue: tags },
        { provide: TaskQueryService, useValue: taskQuery },
        { provide: TaskEventBus, useValue: eventBus },
        { provide: MemberRepository, useValue: members },
      ],
    }).compile();
    service = moduleRef.get(TaskService);
  });

  const baseTask = {
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

  describe('create', () => {
    it('accepts a client-generated id and defaults optional fields', async () => {
      const dto = {
        id: baseTask.id,
        title: '  Buy milk  ',
        time: '06:30 AM',
        date: 'today',
      };
      tasks.create.mockResolvedValue(baseTask);

      const result = await service.create(OWNER, dto);

      expect(tasks.create).toHaveBeenCalledWith({
        id: baseTask.id,
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
        completedAt: null,
      });
      expect(result.id).toBe(baseTask.id);
    });

    it('publishes a task.created event', async () => {
      tasks.create.mockResolvedValue(baseTask);

      await service.create(OWNER, {
        title: 'Buy milk',
        time: '06:30 AM',
        date: 'today',
      });

      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TaskEventType.TASK_CREATED,
          userId: OWNER,
          taskId: baseTask.id,
          data: { title: 'Buy milk' },
        }),
      );
    });

    it('attaches an owned category and tags', async () => {
      categories.findById.mockResolvedValue({
        id: CATEGORY,
        userId: OWNER,
        teamId: null,
      });
      tags.findByIdsForUser.mockResolvedValue([
        { id: TAG_A, userId: OWNER },
        { id: TAG_B, userId: OWNER },
      ]);
      tasks.create.mockResolvedValue({
        ...baseTask,
        categoryId: CATEGORY,
        tags: [{ id: TAG_A }, { id: TAG_B }],
      });

      const result = await service.create(OWNER, {
        title: 'x',
        time: '06:30 AM',
        date: 'today',
        categoryId: CATEGORY,
        tagIds: [TAG_A, TAG_B],
      });

      expect(categories.findById).toHaveBeenCalledWith(CATEGORY);
      expect(tags.findByIdsForUser).toHaveBeenCalledWith(OWNER, [TAG_A, TAG_B]);
      expect(result.tagIds.sort()).toEqual([TAG_A, TAG_B]);
    });

    it('rejects a category owned by another user', async () => {
      categories.findById.mockResolvedValue({
        id: CATEGORY,
        userId: OTHER,
        teamId: null,
      });
      await expect(
        service.create(OWNER, {
          title: 'x',
          time: '06:30 AM',
          date: 'today',
          categoryId: CATEGORY,
        }),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
      expect(tasks.create).not.toHaveBeenCalled();
    });

    it('rejects when not every tag is owned by the caller', async () => {
      categories.findById.mockResolvedValue(null);
      tags.findByIdsForUser.mockResolvedValue([{ id: TAG_A, userId: OWNER }]);
      await expect(
        service.create(OWNER, {
          title: 'x',
          time: '06:30 AM',
          date: 'today',
          tagIds: [TAG_A, TAG_B],
        }),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });

    it('rejects an impossible calendar date', async () => {
      await expect(
        service.create(OWNER, {
          title: 'x',
          time: '06:30 AM',
          date: '2026-99-99',
        }),
      ).rejects.toMatchObject({ code: 'BUSINESS_VALIDATION_ERROR' });
    });
  });

  describe('update', () => {
    it('updates partial fields and trims the title', async () => {
      taskQuery.getOwnedTask.mockResolvedValue({ ...baseTask });
      tasks.save.mockResolvedValue({
        ...baseTask,
        title: 'Milk',
        priority: TaskPriority.HIGH,
      });

      const result = await service.update(OWNER, baseTask.id, {
        title: '  Milk  ',
        priority: TaskPriority.HIGH,
      });

      expect(result.title).toBe('Milk');
      expect(result.priority).toBe(TaskPriority.HIGH);
    });

    it('publishes a task.updated event', async () => {
      taskQuery.getOwnedTask.mockResolvedValue({ ...baseTask });
      tasks.save.mockResolvedValue(baseTask);

      await service.update(OWNER, baseTask.id, { title: 'Milk' });

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TaskEventType.TASK_UPDATED,
          userId: OWNER,
          taskId: baseTask.id,
        }),
      );
    });

    it('clears the category when categoryId is null', async () => {
      taskQuery.getOwnedTask.mockResolvedValue({
        ...baseTask,
        categoryId: CATEGORY,
      });
      tasks.save.mockResolvedValue({ ...baseTask, categoryId: null });

      const result = await service.update(OWNER, baseTask.id, {
        categoryId: null,
      });
      expect(result.categoryId).toBeNull();
    });

    it('clears tags when tagIds is an empty array', async () => {
      taskQuery.getOwnedTask.mockResolvedValue({
        ...baseTask,
        tags: [{ id: TAG_A }],
      });
      tasks.save.mockResolvedValue({ ...baseTask, tags: [] });

      const result = await service.update(OWNER, baseTask.id, { tagIds: [] });
      expect(result.tagIds).toEqual([]);
    });

    it('validates the date when it changes', async () => {
      taskQuery.getOwnedTask.mockResolvedValue({ ...baseTask });
      await expect(
        service.update(OWNER, baseTask.id, { date: '2026-02-30' }),
      ).rejects.toMatchObject({ code: 'BUSINESS_VALIDATION_ERROR' });
    });
  });

  describe('toggleDone / remove', () => {
    it('toggles done and persists', async () => {
      taskQuery.getOwnedTask.mockResolvedValue({ ...baseTask });
      tasks.save.mockResolvedValue({ ...baseTask, isDone: true });

      const result = await service.toggleDone(OWNER, baseTask.id, true);
      expect(result.isDone).toBe(true);
      expect(tasks.save).toHaveBeenCalledTimes(1);
    });

    it('publishes task.completed on completion and task.reopened on reopen', async () => {
      taskQuery.getOwnedTask.mockResolvedValue({ ...baseTask });
      tasks.save.mockResolvedValue({ ...baseTask, isDone: true });

      await service.toggleDone(OWNER, baseTask.id, true);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: TaskEventType.TASK_COMPLETED }),
      );

      taskQuery.getOwnedTask.mockResolvedValue({ ...baseTask, isDone: true });
      tasks.save.mockResolvedValue({ ...baseTask, isDone: false });
      await service.toggleDone(OWNER, baseTask.id, false);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: TaskEventType.TASK_REOPENED }),
      );
    });

    it('removes an owned task', async () => {
      taskQuery.getOwnedTask.mockResolvedValue({ ...baseTask });
      await service.remove(OWNER, baseTask.id);
      expect(tasks.remove).toHaveBeenCalledWith(baseTask.id);
    });

    it('publishes task.deleted before removal completes', async () => {
      taskQuery.getOwnedTask.mockResolvedValue({ ...baseTask });

      await service.remove(OWNER, baseTask.id);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TaskEventType.TASK_DELETED,
          userId: OWNER,
          taskId: baseTask.id,
          data: { title: baseTask.title },
        }),
      );
    });
  });

  describe('team-scoped operations', () => {
    const teamTask = { ...baseTask, teamId: TEAM };

    it('creates a task inside a team', async () => {
      tasks.create.mockResolvedValue(teamTask);

      const result = await service.createInTeam(TEAM, OWNER, {
        title: 'Standup notes',
        time: '09:00 AM',
        date: 'today',
      });

      expect(tasks.create).toHaveBeenCalledWith({
        id: undefined,
        userId: OWNER,
        teamId: TEAM,
        title: 'Standup notes',
        time: '09:00 AM',
        date: 'today',
        isDone: false,
        priority: TaskPriority.MEDIUM,
        notes: null,
        categoryId: null,
        tags: [],
        completedAt: null,
      });
      expect(result.teamId).toBe(TEAM);
    });

    it('notifies the other team members that a task was assigned', async () => {
      members.listByTeam.mockResolvedValue([
        { userId: OWNER },
        { userId: OTHER },
      ]);
      tasks.create.mockResolvedValue(teamTask);

      await service.createInTeam(TEAM, OWNER, {
        title: 'Standup notes',
        time: '09:00 AM',
        date: 'today',
      });

      expect(members.listByTeam).toHaveBeenCalledWith(TEAM);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TaskEventType.TASK_ASSIGNED,
          userId: OTHER,
          taskId: teamTask.id,
        }),
      );
      expect(eventBus.publish).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: TaskEventType.TASK_ASSIGNED,
          userId: OWNER,
        }),
      );
    });

    it('requires team categories and team tags when creating in a team', async () => {
      categories.findById.mockResolvedValue({
        id: CATEGORY,
        userId: OTHER,
        teamId: TEAM,
      });
      tags.findByIdsForTeam.mockResolvedValue([
        { id: TAG_A, teamId: TEAM },
        { id: TAG_B, teamId: TEAM },
      ]);
      tasks.create.mockResolvedValue({
        ...teamTask,
        categoryId: CATEGORY,
        tags: [{ id: TAG_A }, { id: TAG_B }],
      });

      const result = await service.createInTeam(TEAM, OWNER, {
        title: 'x',
        time: '06:30 AM',
        date: 'today',
        categoryId: CATEGORY,
        tagIds: [TAG_A, TAG_B],
      });

      expect(tags.findByIdsForTeam).toHaveBeenCalledWith(TEAM, [TAG_A, TAG_B]);
      expect(result.tagIds.sort()).toEqual([TAG_A, TAG_B]);
    });

    it('rejects a personal category when creating in a team', async () => {
      categories.findById.mockResolvedValue({
        id: CATEGORY,
        userId: OWNER,
        teamId: null,
      });
      await expect(
        service.createInTeam(TEAM, OWNER, {
          title: 'x',
          time: '06:30 AM',
          date: 'today',
          categoryId: CATEGORY,
        }),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
      expect(tasks.create).not.toHaveBeenCalled();
    });

    it('updates a team task', async () => {
      taskQuery.getTeamTask.mockResolvedValue({ ...teamTask });
      tasks.save.mockResolvedValue({ ...teamTask, title: 'Updated' });

      const result = await service.updateInTeam(TEAM, OWNER, teamTask.id, {
        title: ' Updated ',
      });

      expect(taskQuery.getTeamTask).toHaveBeenCalledWith(TEAM, teamTask.id);
      expect(result.title).toBe('Updated');
    });

    it('toggles and removes a team task', async () => {
      taskQuery.getTeamTask.mockResolvedValue({ ...teamTask });
      tasks.save.mockResolvedValue({ ...teamTask, isDone: true });
      const toggled = await service.toggleDoneInTeam(
        TEAM,
        OWNER,
        teamTask.id,
        true,
      );
      expect(toggled.isDone).toBe(true);

      taskQuery.getTeamTask.mockResolvedValue({ ...teamTask });
      await service.removeInTeam(TEAM, OWNER, teamTask.id);
      expect(tasks.remove).toHaveBeenCalledWith(teamTask.id);
    });
  });
});
