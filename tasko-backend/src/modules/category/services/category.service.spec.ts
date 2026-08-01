import { Test } from '@nestjs/testing';
import { CategoryRepository } from '../interfaces/category-repository';
import { CategoryService } from './category.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('CategoryService', () => {
  const repo = {
    findById: jest.fn(),
    findByNameForUser: jest.fn(),
    listByUser: jest.fn(),
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
    name: 'Shopping',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('trims the name and creates the category', async () => {
      repo.findByNameForUser.mockResolvedValue(null);
      repo.create.mockResolvedValue(category);

      const result = await service.create(OWNER, { name: '  Shopping  ' });

      expect(repo.create).toHaveBeenCalledWith({
        userId: OWNER,
        name: 'Shopping',
      });
      expect(result.name).toBe('Shopping');
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
    it('lists only caller-owned categories', async () => {
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
});
