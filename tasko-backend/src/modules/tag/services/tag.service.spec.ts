import { Test } from '@nestjs/testing';
import { TagRepository } from '../interfaces/tag-repository';
import { TagService } from './tag.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const TEAM = '99999999-9999-4999-8999-999999999999';

describe('TagService', () => {
  const repo = {
    findById: jest.fn(),
    findByNameForUser: jest.fn(),
    findByNameForTeam: jest.fn(),
    listByUser: jest.fn(),
    listByTeam: jest.fn(),
    findByIdsForUser: jest.fn(),
    findByIdsForTeam: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  let service: TagService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [TagService, { provide: TagRepository, useValue: repo }],
    }).compile();
    service = moduleRef.get(TagService);
  });

  const tag = {
    id: '33333333-3333-4333-8333-333333333333',
    userId: OWNER,
    teamId: null,
    name: 'Work',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const teamTag = {
    id: '33333333-3333-4333-8333-333333333333',
    userId: OWNER,
    teamId: TEAM,
    name: 'Urgent',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('trims the name and creates a personal tag', async () => {
      repo.findByNameForUser.mockResolvedValue(null);
      repo.create.mockResolvedValue(tag);

      const result = await service.create(OWNER, { name: '  Work  ' });

      expect(repo.create).toHaveBeenCalledWith({
        userId: OWNER,
        teamId: null,
        name: 'Work',
      });
      expect(result.name).toBe('Work');
      expect(result.teamId).toBeNull();
    });

    it('rejects duplicate names (case-insensitive)', async () => {
      repo.findByNameForUser.mockResolvedValue(tag);
      await expect(
        service.create(OWNER, { name: 'work' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('list / get', () => {
    it('lists only the caller-owned personal tags', async () => {
      repo.listByUser.mockResolvedValue([tag]);
      const result = await service.list(OWNER);
      expect(repo.listByUser).toHaveBeenCalledWith(OWNER);
      expect(result).toHaveLength(1);
    });

    it('returns a tag owned by the caller', async () => {
      repo.findById.mockResolvedValue(tag);
      await expect(service.get(OWNER, tag.id)).resolves.toMatchObject({
        name: 'Work',
      });
    });

    it('hides another users tag as not found', async () => {
      repo.findById.mockResolvedValue(tag);
      await expect(service.get(OTHER, tag.id)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
    });

    it('hides a team tag from a personal get', async () => {
      repo.findById.mockResolvedValue(teamTag);
      await expect(service.get(OWNER, teamTag.id)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
    });

    it('returns not found for a missing tag', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.get(OWNER, tag.id)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
    });
  });

  describe('update', () => {
    it('renames an owned tag and rejects duplicates', async () => {
      repo.findById.mockResolvedValue(tag);
      repo.findByNameForUser.mockResolvedValue(null);
      repo.save.mockResolvedValue({ ...tag, name: 'Personal' });

      const result = await service.update(OWNER, tag.id, {
        name: '  Personal  ',
      });
      expect(result.name).toBe('Personal');
      expect(repo.save).toHaveBeenCalled();
    });

    it('allows keeping the current name (self-duplicate)', async () => {
      repo.findById.mockResolvedValue(tag);
      repo.findByNameForUser.mockResolvedValue(tag);
      repo.save.mockResolvedValue(tag);

      await expect(
        service.update(OWNER, tag.id, { name: 'Work' }),
      ).resolves.toBeDefined();
    });

    it('rejects an update on another users tag', async () => {
      repo.findById.mockResolvedValue(tag);
      await expect(
        service.update(OTHER, tag.id, { name: 'X' }),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });
  });

  describe('remove', () => {
    it('deletes an owned tag', async () => {
      repo.findById.mockResolvedValue(tag);
      await service.remove(OWNER, tag.id);
      expect(repo.remove).toHaveBeenCalledWith(tag.id);
    });

    it('rejects deleting another users tag', async () => {
      repo.findById.mockResolvedValue(tag);
      await expect(service.remove(OTHER, tag.id)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });

  describe('team-scoped operations', () => {
    it('creates a team tag with the caller as creator', async () => {
      repo.findByNameForTeam.mockResolvedValue(null);
      repo.create.mockResolvedValue(teamTag);

      const result = await service.createInTeam(TEAM, OWNER, {
        name: '  Urgent  ',
      });

      expect(repo.create).toHaveBeenCalledWith({
        userId: OWNER,
        teamId: TEAM,
        name: 'Urgent',
      });
      expect(result.teamId).toBe(TEAM);
    });

    it('rejects duplicate team tag names', async () => {
      repo.findByNameForTeam.mockResolvedValue(teamTag);
      await expect(
        service.createInTeam(TEAM, OWNER, { name: 'urgent' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('lists team tags', async () => {
      repo.listByTeam.mockResolvedValue([teamTag]);
      const result = await service.listForTeam(TEAM);
      expect(repo.listByTeam).toHaveBeenCalledWith(TEAM);
      expect(result).toHaveLength(1);
    });

    it('gets a team tag within the team', async () => {
      repo.findById.mockResolvedValue(teamTag);
      await expect(service.getInTeam(TEAM, teamTag.id)).resolves.toMatchObject({
        name: 'Urgent',
        teamId: TEAM,
      });
    });

    it('hides a tag from another team as not found', async () => {
      repo.findById.mockResolvedValue(teamTag);
      await expect(
        service.getInTeam('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', teamTag.id),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });

    it('updates a team tag and enforces team-scoped uniqueness', async () => {
      repo.findById.mockResolvedValue(teamTag);
      repo.findByNameForTeam.mockResolvedValue(null);
      repo.save.mockResolvedValue({ ...teamTag, name: 'Very urgent' });

      const result = await service.updateInTeam(TEAM, teamTag.id, {
        name: 'Very urgent',
      });
      expect(result.name).toBe('Very urgent');
    });

    it('rejects renaming a team tag to a duplicate', async () => {
      repo.findById.mockResolvedValue(teamTag);
      repo.findByNameForTeam.mockResolvedValue({ ...teamTag, id: 'other' });
      await expect(
        service.updateInTeam(TEAM, teamTag.id, { name: 'Other' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('removes a team tag', async () => {
      repo.findById.mockResolvedValue(teamTag);
      await service.removeFromTeam(TEAM, teamTag.id);
      expect(repo.remove).toHaveBeenCalledWith(teamTag.id);
    });

    it('rejects removing a tag from another team', async () => {
      repo.findById.mockResolvedValue(teamTag);
      await expect(
        service.removeFromTeam(
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          teamTag.id,
        ),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });
});
