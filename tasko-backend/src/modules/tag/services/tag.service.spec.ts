import { Test } from '@nestjs/testing';
import { TagRepository } from '../interfaces/tag-repository';
import { TagService } from './tag.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('TagService', () => {
  const repo = {
    findById: jest.fn(),
    findByNameForUser: jest.fn(),
    listByUser: jest.fn(),
    findByIdsForUser: jest.fn(),
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
    name: 'Work',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('trims the name and creates the tag', async () => {
      repo.findByNameForUser.mockResolvedValue(null);
      repo.create.mockResolvedValue(tag);

      const result = await service.create(OWNER, { name: '  Work  ' });

      expect(repo.create).toHaveBeenCalledWith({ userId: OWNER, name: 'Work' });
      expect(result.name).toBe('Work');
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
    it('lists only the caller-owned tags', async () => {
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
});
