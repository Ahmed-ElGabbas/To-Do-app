import { Test } from '@nestjs/testing';
import { CategoryRepository } from '../interfaces/category-repository';
import { CategoryService } from './category.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const TEAM = '99999999-9999-4999-8999-999999999999';

describe('CategoryService', () => {
  const repo = {
    findById: jest.fn(),
    findByNameForUser: jest.fn(),
    findByNameForTeam: jest.fn(),
    listByUser: jest.fn(),
    listByTeam: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  let service: CategoryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: CategoryRepository, useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(CategoryService);
  });

  const category = {
    id: '33333333-3333-4333-8333-333333333333',
    userId: OWNER,
    teamId: null,
    name: 'Shopping',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const teamCategory = {
    id: '33333333-3333-4333-8333-333333333333',
    userId: OWNER,
    teamId: TEAM,
    name: 'Design',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('trims the name and creates a personal category', async () => {
      repo.findByNameForUser.mockResolvedValue(null);
      repo.create.mockResolvedValue(category);

      const result = await service.create(OWNER, { name: '  Shopping  ' });

      expect(repo.create).toHaveBeenCalledWith({
        userId: OWNER,
        teamId: null,
        name: 'Shopping',
      });
      expect(result.name).toBe('Shopping');
      expect(result.teamId).toBeNull();
    });

    it('rejects duplicate names (case-insensitive)', async () => {
      repo.findByNameForUser.mockResolvedValue(category);
      await expect(
        service.create(OWNER, { name: 'shopping' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('list / get', () => {
    it('lists only caller-owned personal categories', async () => {
      repo.listByUser.mockResolvedValue([category]);
      const result = await service.list(OWNER);
      expect(repo.listByUser).toHaveBeenCalledWith(OWNER);
      expect(result).toHaveLength(1);
    });

    it('hides another users category as not found', async () => {
      repo.findById.mockResolvedValue(category);
      await expect(service.get(OTHER, category.id)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
    });

    it('hides a team category from a personal get', async () => {
      repo.findById.mockResolvedValue(teamCategory);
      await expect(service.get(OWNER, teamCategory.id)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
    });
  });

  describe('update', () => {
    it('renames an owned category', async () => {
      repo.findById.mockResolvedValue(category);
      repo.findByNameForUser.mockResolvedValue(null);
      repo.save.mockResolvedValue({ ...category, name: 'Groceries' });

      const result = await service.update(OWNER, category.id, {
        name: 'Groceries',
      });
      expect(result.name).toBe('Groceries');
    });
  });

  describe('remove', () => {
    it('deletes an owned category', async () => {
      repo.findById.mockResolvedValue(category);
      await service.remove(OWNER, category.id);
      expect(repo.remove).toHaveBeenCalledWith(category.id);
    });

    it('rejects deleting another users category', async () => {
      repo.findById.mockResolvedValue(category);
      await expect(service.remove(OTHER, category.id)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });

  describe('team-scoped operations', () => {
    it('creates a team category with the caller as creator', async () => {
      repo.findByNameForTeam.mockResolvedValue(null);
      repo.create.mockResolvedValue(teamCategory);

      const result = await service.createInTeam(TEAM, OWNER, {
        name: '  Design  ',
      });

      expect(repo.create).toHaveBeenCalledWith({
        userId: OWNER,
        teamId: TEAM,
        name: 'Design',
      });
      expect(result.teamId).toBe(TEAM);
    });

    it('rejects duplicate team category names', async () => {
      repo.findByNameForTeam.mockResolvedValue(teamCategory);
      await expect(
        service.createInTeam(TEAM, OWNER, { name: 'design' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('lists team categories', async () => {
      repo.listByTeam.mockResolvedValue([teamCategory]);
      const result = await service.listForTeam(TEAM);
      expect(repo.listByTeam).toHaveBeenCalledWith(TEAM);
      expect(result).toHaveLength(1);
    });

    it('gets a team category within the team', async () => {
      repo.findById.mockResolvedValue(teamCategory);
      await expect(
        service.getInTeam(TEAM, teamCategory.id),
      ).resolves.toMatchObject({ name: 'Design', teamId: TEAM });
    });

    it('hides a category from another team as not found', async () => {
      repo.findById.mockResolvedValue(teamCategory);
      await expect(
        service.getInTeam(
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          teamCategory.id,
        ),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });

    it('updates a team category and enforces team-scoped uniqueness', async () => {
      repo.findById.mockResolvedValue(teamCategory);
      repo.findByNameForTeam.mockResolvedValue(null);
      repo.save.mockResolvedValue({ ...teamCategory, name: 'Design v2' });

      const result = await service.updateInTeam(TEAM, teamCategory.id, {
        name: 'Design v2',
      });
      expect(result.name).toBe('Design v2');
    });

    it('rejects renaming a team category to a duplicate', async () => {
      repo.findById.mockResolvedValue(teamCategory);
      repo.findByNameForTeam.mockResolvedValue({
        ...teamCategory,
        id: 'other',
      });
      await expect(
        service.updateInTeam(TEAM, teamCategory.id, { name: 'Other' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('removes a team category', async () => {
      repo.findById.mockResolvedValue(teamCategory);
      await service.removeFromTeam(TEAM, teamCategory.id);
      expect(repo.remove).toHaveBeenCalledWith(teamCategory.id);
    });

    it('rejects removing a category from another team', async () => {
      repo.findById.mockResolvedValue(teamCategory);
      await expect(
        service.removeFromTeam(
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          teamCategory.id,
        ),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });
});
