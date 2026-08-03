import { Test } from '@nestjs/testing';
import { TeamRole } from '../../../common/constants/team-role.enum';
import { CategoryRepository } from '../../category/interfaces/category-repository';
import { MemberRepository } from '../../member/interfaces/member-repository';
import { TagRepository } from '../../tag/interfaces/tag-repository';
import { TaskPriority } from '../../../common/constants/task-priority.enum';
import { TaskRepository } from '../../task/interfaces/task-repository';
import { TeamRepository } from '../../team/interfaces/team-repository';
import { SearchScope } from '../constants/search-scope.enum';
import { SearchService } from './search.service';

const USER = '11111111-1111-4111-8111-111111111111';
const TEAM_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TEAM_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER_TEAM = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('SearchService', () => {
  const tasks = { search: jest.fn() };
  const teams = { listForMember: jest.fn(), searchForMember: jest.fn() };
  const categories = { searchForUser: jest.fn() };
  const tags = { searchForUser: jest.fn() };
  const members = { findByTeamAndUser: jest.fn() };

  let service: SearchService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: TaskRepository, useValue: tasks },
        { provide: TeamRepository, useValue: teams },
        { provide: CategoryRepository, useValue: categories },
        { provide: TagRepository, useValue: tags },
        { provide: MemberRepository, useValue: members },
      ],
    }).compile();
    service = moduleRef.get(SearchService);
  });

  const user = { id: USER, email: 'u@example.com', role: 'user' };
  const dto = (overrides: Record<string, unknown> = {}) => ({
    q: '  sprint  ',
    ...overrides,
  });

  const task = {
    id: 't1',
    title: 'Design sprint',
    time: '09:00 AM',
    date: 'today',
    isDone: false,
    priority: TaskPriority.MEDIUM,
    notes: null,
    teamId: TEAM_A,
    categoryId: null,
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const team = {
    id: TEAM_A,
    name: 'Sprint Squad',
    description: 'Build fast',
    ownerId: USER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const category = {
    id: 'c1',
    name: 'Design',
    teamId: TEAM_A,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const tag = {
    id: 'g1',
    name: 'Urgent',
    teamId: TEAM_A,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('scope resolution', () => {
    it('searches across personal + all member teams by default', async () => {
      teams.listForMember.mockResolvedValue([
        { team, role: TeamRole.OWNER },
        { team: { ...team, id: TEAM_B }, role: TeamRole.VIEWER },
      ]);
      tasks.search.mockResolvedValue([[task], 1]);
      teams.searchForMember.mockResolvedValue([[team], 1]);
      categories.searchForUser.mockResolvedValue([[category], 1]);
      tags.searchForUser.mockResolvedValue([[tag], 1]);

      const result = await service.search(user, dto());

      expect(teams.listForMember).toHaveBeenCalledWith(USER);
      expect(tasks.search).toHaveBeenCalledWith({
        q: 'sprint',
        userId: USER,
        teamIds: [TEAM_A, TEAM_B],
        page: 1,
        limit: 20,
      });
      expect(teams.searchForMember).toHaveBeenCalledWith(USER, 'sprint', {
        teamId: undefined,
        page: 1,
        limit: 20,
      });
      expect(categories.searchForUser).toHaveBeenCalledWith(
        USER,
        [TEAM_A, TEAM_B],
        'sprint',
        1,
        20,
      );
      expect(tags.searchForUser).toHaveBeenCalledWith(
        USER,
        [TEAM_A, TEAM_B],
        'sprint',
        1,
        20,
      );
      expect(result.results.tasks.total).toBe(1);
      expect(result.results.tasks.items[0].type).toBe('task');
      expect(result.results.tasks.items[0].title).toBe('Design sprint');
      expect(result.results.teams.items[0].type).toBe('team');
      expect(result.results.categories.items[0].type).toBe('category');
      expect(result.results.tags.items[0].type).toBe('tag');
    });

    it('restricts to a team after checking membership', async () => {
      members.findByTeamAndUser.mockResolvedValue({
        id: 'm1',
        teamId: TEAM_A,
        role: TeamRole.VIEWER,
      });
      tasks.search.mockResolvedValue([[], 0]);
      teams.searchForMember.mockResolvedValue([[], 0]);
      categories.searchForUser.mockResolvedValue([[], 0]);
      tags.searchForUser.mockResolvedValue([[], 0]);

      await service.search(user, dto({ teamId: TEAM_A }));

      expect(members.findByTeamAndUser).toHaveBeenCalledWith(TEAM_A, USER);
      expect(teams.listForMember).not.toHaveBeenCalled();
      expect(tasks.search).toHaveBeenCalledWith({
        q: 'sprint',
        userId: USER,
        teamIds: [TEAM_A],
        page: 1,
        limit: 20,
      });
      expect(teams.searchForMember).toHaveBeenCalledWith(USER, 'sprint', {
        teamId: TEAM_A,
        page: 1,
        limit: 20,
      });
    });

    it('rejects a team the caller does not belong to as 403', async () => {
      members.findByTeamAndUser.mockResolvedValue(null);

      await expect(
        service.search(user, dto({ teamId: OTHER_TEAM })),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(tasks.search).not.toHaveBeenCalled();
    });

    it('handles a user with no teams (personal scope only)', async () => {
      teams.listForMember.mockResolvedValue([]);
      tasks.search.mockResolvedValue([[task], 1]);
      teams.searchForMember.mockResolvedValue([[], 0]);
      categories.searchForUser.mockResolvedValue([[], 0]);
      tags.searchForUser.mockResolvedValue([[], 0]);

      const result = await service.search(user, dto());

      expect(tasks.search).toHaveBeenCalledWith({
        q: 'sprint',
        userId: USER,
        teamIds: [],
        page: 1,
        limit: 20,
      });
      expect(result.results.tasks.items).toHaveLength(1);
    });
  });

  describe('scope filtering', () => {
    it('searches only tasks when scope=tasks', async () => {
      tasks.search.mockResolvedValue([[task], 1]);
      const result = await service.search(
        user,
        dto({ scope: SearchScope.TASKS }),
      );

      expect(tasks.search).toHaveBeenCalled();
      expect(teams.searchForMember).not.toHaveBeenCalled();
      expect(categories.searchForUser).not.toHaveBeenCalled();
      expect(tags.searchForUser).not.toHaveBeenCalled();
      expect(result.results.teams.total).toBe(0);
      expect(result.results.teams.items).toEqual([]);
    });

    it('honours page and limit from the DTO', async () => {
      teams.listForMember.mockResolvedValue([]);
      tasks.search.mockResolvedValue([[], 0]);
      teams.searchForMember.mockResolvedValue([[], 0]);
      categories.searchForUser.mockResolvedValue([[], 0]);
      tags.searchForUser.mockResolvedValue([[], 0]);

      await service.search(user, dto({ page: 3, limit: 5 }));

      expect(tasks.search).toHaveBeenCalledWith(
        expect.objectContaining({ page: 3, limit: 5 }),
      );
      expect(categories.searchForUser).toHaveBeenCalledWith(
        USER,
        [],
        'sprint',
        3,
        5,
      );
    });
  });
});
