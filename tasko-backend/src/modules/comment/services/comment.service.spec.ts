import { Test } from '@nestjs/testing';
import { TeamRole } from '../../../common/constants/team-role.enum';
import { TaskEventType } from '../../../infrastructure/events/task-event';
import { TaskEventBus } from '../../../infrastructure/events/task-event-bus.service';
import { MemberRepository } from '../../member/interfaces/member-repository';
import { TaskRepository } from '../../task/interfaces/task-repository';
import { CommentRepository } from '../interfaces/comment-repository';
import { CommentService } from './comment.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const MEMBER = '22222222-2222-4222-8222-222222222222';
const STRANGER = '33333333-3333-4333-8333-333333333333';
const TASK_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COMMENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TEAM_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('CommentService', () => {
  const comments = {
    listByTask: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const tasks = { findById: jest.fn() };
  const members = { findByTeamAndUser: jest.fn() };
  const eventBus = { publish: jest.fn(), register: jest.fn() };

  let service: CommentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CommentService,
        { provide: CommentRepository, useValue: comments },
        { provide: TaskRepository, useValue: tasks },
        { provide: MemberRepository, useValue: members },
        { provide: TaskEventBus, useValue: eventBus },
      ],
    }).compile();
    service = moduleRef.get(CommentService);
  });

  const personalTask = {
    id: TASK_ID,
    userId: OWNER,
    teamId: null,
    title: 'Ship the app',
  };
  const teamTask = {
    id: TASK_ID,
    userId: OWNER,
    teamId: TEAM_ID,
    title: 'Ship the app',
  };
  const comment = {
    id: COMMENT_ID,
    taskId: TASK_ID,
    userId: MEMBER,
    body: 'Looks good',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const memberRow = (role: TeamRole) => ({ id: 'm1', teamId: TEAM_ID, role });

  describe('list', () => {
    it('returns comments for an owned personal task', async () => {
      tasks.findById.mockResolvedValue(personalTask);
      comments.listByTask.mockResolvedValue([comment]);
      const result = await service.list(TASK_ID, OWNER);
      expect(result).toHaveLength(1);
      expect(result[0].body).toBe('Looks good');
    });

    it('hides another users personal task as 404', async () => {
      tasks.findById.mockResolvedValue(personalTask);
      await expect(service.list(TASK_ID, STRANGER)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
      expect(comments.listByTask).not.toHaveBeenCalled();
    });

    it('returns comments for a team member', async () => {
      tasks.findById.mockResolvedValue(teamTask);
      members.findByTeamAndUser.mockResolvedValue(memberRow(TeamRole.VIEWER));
      comments.listByTask.mockResolvedValue([]);
      const result = await service.list(TASK_ID, MEMBER);
      expect(result).toEqual([]);
    });

    it('hides a team task from a non-member as 404', async () => {
      tasks.findById.mockResolvedValue(teamTask);
      members.findByTeamAndUser.mockResolvedValue(null);
      await expect(service.list(TASK_ID, STRANGER)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
    });
  });

  describe('create', () => {
    it('creates a comment on an accessible task', async () => {
      tasks.findById.mockResolvedValue(personalTask);
      comments.create.mockResolvedValue(comment);
      const result = await service.create(TASK_ID, OWNER, {
        body: '  Looks good  ',
      });
      expect(comments.create).toHaveBeenCalledWith({
        taskId: TASK_ID,
        userId: OWNER,
        body: 'Looks good',
      });
      expect(result.id).toBe(COMMENT_ID);
    });

    it('rejects commenting on an inaccessible task as 404', async () => {
      tasks.findById.mockResolvedValue(personalTask);
      await expect(
        service.create(TASK_ID, STRANGER, { body: 'hi' }),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });

    it('rejects a missing task as 404', async () => {
      tasks.findById.mockResolvedValue(null);
      await expect(
        service.create(TASK_ID, MEMBER, { body: 'hi' }),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });

    it('notifies the task owner when someone else comments', async () => {
      tasks.findById.mockResolvedValue(teamTask);
      members.findByTeamAndUser.mockResolvedValue(memberRow(TeamRole.VIEWER));
      comments.create.mockResolvedValue(comment);

      await service.create(TASK_ID, MEMBER, { body: 'Nice work' });

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TaskEventType.COMMENT_ADDED,
          userId: OWNER,
          taskId: TASK_ID,
          data: expect.objectContaining({ commentId: COMMENT_ID }),
        }),
      );
    });

    it('does not notify the author about their own comment', async () => {
      tasks.findById.mockResolvedValue(personalTask);
      comments.create.mockResolvedValue({ ...comment, userId: OWNER });

      await service.create(TASK_ID, OWNER, { body: 'Self note' });

      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('lets the author edit their comment on a personal task', async () => {
      comments.findById.mockResolvedValue({ ...comment, userId: OWNER });
      tasks.findById.mockResolvedValue(personalTask);
      comments.save.mockResolvedValue({ ...comment, body: 'Edited' });
      const result = await service.update(COMMENT_ID, OWNER, {
        body: 'Edited',
      });
      expect(result.body).toBe('Edited');
    });

    it('lets the author edit their comment on a team task', async () => {
      comments.findById.mockResolvedValue(comment);
      tasks.findById.mockResolvedValue(teamTask);
      members.findByTeamAndUser.mockResolvedValue(memberRow(TeamRole.VIEWER));
      comments.save.mockResolvedValue(comment);
      await service.update(COMMENT_ID, MEMBER, { body: 'Updated' });
      expect(comments.save).toHaveBeenCalled();
    });

    it('lets a team editor edit a comment written by someone else', async () => {
      comments.findById.mockResolvedValue({ ...comment });
      tasks.findById.mockResolvedValue(teamTask);
      members.findByTeamAndUser.mockResolvedValue(memberRow(TeamRole.EDITOR));
      comments.save.mockImplementation((entity) => Promise.resolve(entity));
      const result = await service.update(COMMENT_ID, STRANGER, { body: 'x' });
      expect(result.body).toBe('x');
      expect(comments.save).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'x' }),
      );
    });

    it('rejects a non-author viewer on a team task as 403', async () => {
      comments.findById.mockResolvedValue(comment);
      tasks.findById.mockResolvedValue(teamTask);
      members.findByTeamAndUser.mockResolvedValue(memberRow(TeamRole.VIEWER));
      await expect(
        service.update(COMMENT_ID, STRANGER, { body: 'x' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(comments.save).not.toHaveBeenCalled();
    });

    it('rejects a non-member editing a team comment as 404', async () => {
      comments.findById.mockResolvedValue(comment);
      tasks.findById.mockResolvedValue(teamTask);
      members.findByTeamAndUser.mockResolvedValue(null);
      await expect(
        service.update(COMMENT_ID, STRANGER, { body: 'x' }),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });

    it('rejects editing a non-author on a personal task as 403', async () => {
      comments.findById.mockResolvedValue({ ...comment, userId: MEMBER });
      tasks.findById.mockResolvedValue(personalTask);
      await expect(
        service.update(COMMENT_ID, OWNER, { body: 'x' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('rejects a missing comment as 404', async () => {
      comments.findById.mockResolvedValue(null);
      await expect(
        service.update(COMMENT_ID, MEMBER, { body: 'x' }),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });
  });

  describe('remove', () => {
    it('lets the author delete their comment', async () => {
      comments.findById.mockResolvedValue(comment);
      tasks.findById.mockResolvedValue(teamTask);
      members.findByTeamAndUser.mockResolvedValue(memberRow(TeamRole.VIEWER));
      await service.remove(COMMENT_ID, MEMBER);
      expect(comments.remove).toHaveBeenCalledWith(COMMENT_ID);
    });

    it('rejects a non-author viewer as 403', async () => {
      comments.findById.mockResolvedValue(comment);
      tasks.findById.mockResolvedValue(teamTask);
      members.findByTeamAndUser.mockResolvedValue(memberRow(TeamRole.VIEWER));
      await expect(service.remove(COMMENT_ID, STRANGER)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      expect(comments.remove).not.toHaveBeenCalled();
    });
  });
});
