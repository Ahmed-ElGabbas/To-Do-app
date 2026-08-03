import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { Role } from '../../common/constants/role.enum';
import { UserController } from './controllers/user.controller';
import { UserOutput } from './dto/user-output.dto';
import { UserEntity } from './entities/user.entity';
import { UserService } from './user.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';

describe('UserController + UserService', () => {
  const repo = {
    findOne: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const user: UserEntity = {
    id: USER_ID,
    email: 'alice@example.com',
    passwordHash: 'never-serialized',
    firstName: 'Alice',
    lastName: 'Example',
    role: Role.USER,
    isEmailVerified: true,
    emailVerifiedAt: new Date('2025-01-01T00:00:00Z'),
    lastLoginAt: null,
    avatarFileId: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  };

  let service: UserService;
  let controller: UserController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(UserEntity), useValue: repo },
        UserController,
      ],
    }).compile();
    service = moduleRef.get(UserService);
    controller = moduleRef.get(UserController);
  });

  describe('getProfile', () => {
    it('returns the serialized profile without the password hash', async () => {
      repo.findOne.mockResolvedValue(user);

      const result = await service.getProfile(USER_ID);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: USER_ID } });
      expect(result).toEqual({
        id: USER_ID,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: Role.USER,
        isEmailVerified: true,
        avatarFileId: null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('throws RESOURCE_NOT_FOUND for a missing user', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.getProfile(USER_ID)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
    });
  });

  describe('updateProfile', () => {
    it('merges the provided fields and persists the change', async () => {
      repo.findOne.mockResolvedValue(user);
      repo.save.mockImplementation((entity: UserEntity) =>
        Promise.resolve(entity),
      );

      const result = await service.updateProfile(USER_ID, {
        firstName: 'Alicia',
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: USER_ID,
          firstName: 'Alicia',
          lastName: 'Example',
        }),
      );
      expect(result.firstName).toBe('Alicia');
      expect(result.lastName).toBe('Example');
    });
  });

  describe('controller wiring', () => {
    it('GET /users/me delegates to getProfile with the caller id', async () => {
      const spy = jest
        .spyOn(service, 'getProfile')
        .mockResolvedValue({ ...user, avatarFileId: null });

      await controller.me({ id: USER_ID } as AuthenticatedUser);

      expect(spy).toHaveBeenCalledWith(USER_ID);
    });

    it('GET /users/:id delegates to getProfile with the param id', async () => {
      const spy = jest
        .spyOn(service, 'getProfile')
        .mockResolvedValue({ id: USER_ID } as UserOutput);

      await controller.get(USER_ID);

      expect(spy).toHaveBeenCalledWith(USER_ID);
    });

    it('PATCH /users/me delegates to updateProfile with the caller id', async () => {
      const spy = jest
        .spyOn(service, 'updateProfile')
        .mockResolvedValue({ id: USER_ID, firstName: 'Alicia' } as UserOutput);

      await controller.updateMe({ id: USER_ID } as AuthenticatedUser, {
        firstName: 'Alicia',
      });

      expect(spy).toHaveBeenCalledWith(USER_ID, { firstName: 'Alicia' });
    });
  });
});
