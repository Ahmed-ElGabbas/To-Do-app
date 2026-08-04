import { Test } from '@nestjs/testing';
import { ResourceNotFoundError } from '../../../common/errors/domain-error';
import { Role } from '../../../common/constants/role.enum';
import { TeamRole } from '../../../common/constants/team-role.enum';
import { TaskEventType } from '../../../infrastructure/events/task-event';
import { TaskEventBus } from '../../../infrastructure/events/task-event-bus.service';
import { MemberRepository } from '../../member/interfaces/member-repository';
import { TaskRepository } from '../../task/interfaces/task-repository';
import { TeamRepository } from '../../team/interfaces/team-repository';
import { UserService } from '../../user/user.service';
import { AdminService } from './admin.service';

const ADMIN = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const TEAM = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('AdminService', () => {
  const users = {
    countAll: jest.fn(),
    listForAdmin: jest.fn(),
    findById: jest.fn(),
    updateRole: jest.fn(),
  };
  const teams = {
    countAll: jest.fn(),
    listAllForAdmin: jest.fn(),
    findById: jest.fn(),
  };
  const members = { countByTeamIds: jest.fn(), listByTeamDetailed: jest.fn() };
  const tasks = { countAll: jest.fn(), countCompleted: jest.fn() };
  const eventBus = { publish: jest.fn() };

  let service: AdminService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: UserService, useValue: users },
        { provide: TeamRepository, useValue: teams },
        { provide: MemberRepository, useValue: members },
        { provide: TaskRepository, useValue: tasks },
        { provide: TaskEventBus, useValue: eventBus },
      ],
    }).compile();
    service = moduleRef.get(AdminService);
  });

  describe('stats', () => {
    it('aggregates the platform counters', async () => {
      users.countAll.mockResolvedValue(3);
      teams.countAll.mockResolvedValue(2);
      tasks.countAll.mockResolvedValue(10);
      tasks.countCompleted.mockResolvedValue(4);

      await expect(service.stats()).resolves.toEqual({
        totalUsers: 3,
        totalTeams: 2,
        totalTasks: 10,
        completedTasks: 4,
      });
    });
  });

  describe('listUsers', () => {
    it('delegates and maps to the admin output with pagination', async () => {
      users.listForAdmin.mockResolvedValue([
        [userEntity(TARGET), userEntity(ADMIN, Role.ADMIN)],
        7,
      ]);

      const result = await service.listUsers('alice', 2, 10);

      expect(users.listForAdmin).toHaveBeenCalledWith('alice', 2, 10);
      expect(result).toEqual({
        items: [
          expect.objectContaining({ id: TARGET, role: Role.USER }),
          expect.objectContaining({ id: ADMIN, role: Role.ADMIN }),
        ],
        page: 2,
        limit: 10,
        total: 7,
        totalPages: 1,
      });
    });
  });

  describe('getUser', () => {
    it('returns the user when found', async () => {
      users.findById.mockResolvedValue(userEntity(TARGET));
      await expect(service.getUser(TARGET)).resolves.toEqual(
        expect.objectContaining({ id: TARGET }),
      );
    });
  });

  describe('updateRole', () => {
    it('promotes a user to admin and emits an audit event', async () => {
      users.findById.mockResolvedValue(userEntity(TARGET));
      users.updateRole.mockResolvedValue(userEntity(TARGET, Role.ADMIN));

      const result = await service.updateRole(ADMIN, TARGET, Role.ADMIN);

      expect(users.updateRole).toHaveBeenCalledWith(TARGET, Role.ADMIN);
      expect(result.role).toBe(Role.ADMIN);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TaskEventType.USER_ROLE_CHANGED,
          userId: ADMIN,
          data: {
            targetUserId: TARGET,
            targetEmail: `${TARGET}@example.com`,
            previousRole: Role.USER,
            newRole: Role.ADMIN,
          },
        }),
      );
    });

    it('rejects an admin demoting themselves', async () => {
      await expect(service.updateRole(ADMIN, ADMIN, Role.USER)).rejects.toThrow(
        'Admins cannot change their own role',
      );
      expect(users.updateRole).not.toHaveBeenCalled();
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('allows an admin to keep themselves as admin', async () => {
      users.findById.mockResolvedValue(userEntity(ADMIN, Role.ADMIN));
      users.updateRole.mockResolvedValue(userEntity(ADMIN, Role.ADMIN));
      await expect(
        service.updateRole(ADMIN, ADMIN, Role.ADMIN),
      ).resolves.toEqual(expect.objectContaining({ role: Role.ADMIN }));
    });
  });

  describe('listTeams', () => {
    it('annotates each team with its member count', async () => {
      teams.listAllForAdmin.mockResolvedValue([
        [teamEntity(TEAM), teamEntity('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')],
        2,
      ]);
      members.countByTeamIds.mockResolvedValue([
        { teamId: TEAM, count: 3 },
        { teamId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', count: 1 },
      ]);

      const result = await service.listTeams(undefined, 1, 20);

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual(
        expect.objectContaining({ id: TEAM, memberCount: 3 }),
      );
      expect(result.total).toBe(2);
    });

    it('reports zero members when the count query returns nothing', async () => {
      teams.listAllForAdmin.mockResolvedValue([[teamEntity(TEAM)], 1]);
      members.countByTeamIds.mockResolvedValue([]);

      const result = await service.listTeams(undefined, 1, 20);
      expect(result.items[0].memberCount).toBe(0);
    });
  });

  describe('getTeam', () => {
    it('returns the team with its members', async () => {
      teams.findById.mockResolvedValue(teamEntity(TEAM));
      members.listByTeamDetailed.mockResolvedValue([
        {
          member: {
            id: 'm1',
            teamId: TEAM,
            userId: TARGET,
            role: TeamRole.EDITOR,
          },
          user: {
            id: TARGET,
            email: 'target@example.com',
            firstName: 'Alice',
            lastName: 'Smith',
          },
        },
      ]);

      const result = await service.getTeam(TEAM);

      expect(result.team.id).toBe(TEAM);
      expect(result.members).toEqual([
        {
          memberId: 'm1',
          userId: TARGET,
          role: TeamRole.EDITOR,
          email: 'target@example.com',
          firstName: 'Alice',
          lastName: 'Smith',
        },
      ]);
    });

    it('throws when the team does not exist', async () => {
      teams.findById.mockResolvedValue(null);
      await expect(service.getTeam(TEAM)).rejects.toBeInstanceOf(
        ResourceNotFoundError,
      );
    });
  });
});

function userEntity(id: string, role: Role = Role.USER) {
  return {
    id,
    email: `${id}@example.com`,
    firstName: 'Alice',
    lastName: 'Smith',
    role,
    isEmailVerified: false,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
  };
}

function teamEntity(id: string) {
  return {
    id,
    name: 'Squad',
    description: null,
    ownerId: ADMIN,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
  };
}
