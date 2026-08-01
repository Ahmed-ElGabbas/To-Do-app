import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { FileKind } from '../../../common/constants/file-kind.enum';
import { StorageService } from '../../../infrastructure/storage/storage.service';
import { UserService } from '../../user/user.service';
import { FileRepository } from '../interfaces/file-repository';
import { FileService } from './file.service';

const USER = '11111111-1111-4111-8111-111111111111';

describe('FileService', () => {
  const files = {
    findById: jest.fn(),
    findByUserAndKind: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };
  const storage = {
    save: jest.fn(),
    getUrl: jest.fn(),
    delete: jest.fn(),
  };
  const users = {
    setAvatar: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => {
      const map: Record<string, unknown> = {
        'storage.maxFileSizeBytes': 5 * 1024 * 1024,
      };
      return key in map ? map[key] : fallback;
    }),
  };

  let service: FileService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        FileService,
        { provide: FileRepository, useValue: files },
        { provide: StorageService, useValue: storage },
        { provide: UserService, useValue: users },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(FileService);
  });

  const makeFile = (
    overrides: Partial<Express.Multer.File> = {},
  ): Express.Multer.File =>
    ({
      fieldname: 'file',
      originalname: 'photo.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from([1, 2, 3]),
      ...overrides,
    }) as Express.Multer.File;

  const fileRow = {
    id: '22222222-2222-4222-8222-222222222222',
    userId: USER,
    kind: FileKind.AVATAR,
    mimeType: 'image/jpeg',
    size: 1024,
    originalName: 'photo.jpg',
    storageKey: 'avatars/11111111-1111-4111-8111-111111111111/x.jpg',
    createdAt: new Date(),
  };

  describe('uploadAvatar', () => {
    it('stores the file, records metadata, and points the user at it', async () => {
      files.findByUserAndKind.mockResolvedValue(null);
      files.create.mockResolvedValue(fileRow);
      storage.getUrl.mockResolvedValue('https://storage/avatar-url');

      const result = await service.uploadAvatar(USER, makeFile());

      expect(storage.save).toHaveBeenCalledTimes(1);
      expect(files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER,
          kind: FileKind.AVATAR,
          mimeType: 'image/jpeg',
          size: 1024,
        }),
      );
      expect(users.setAvatar).toHaveBeenCalledWith(USER, fileRow.id);
      expect(result.url).toBe('https://storage/avatar-url');
      expect(result.kind).toBe(FileKind.AVATAR);
    });

    it('removes the previous avatar and its object when replacing', async () => {
      files.findByUserAndKind.mockResolvedValueOnce(fileRow);
      files.create.mockResolvedValue(fileRow);
      storage.getUrl.mockResolvedValue('https://storage/avatar-url');

      await service.uploadAvatar(USER, makeFile());

      expect(files.remove).toHaveBeenCalledWith(fileRow.id);
      expect(storage.delete).toHaveBeenCalledWith(fileRow.storageKey);
    });

    it('rejects when no file is present', async () => {
      await expect(service.uploadAvatar(USER, undefined)).rejects.toMatchObject(
        { code: 'VALIDATION_ERROR' },
      );
      expect(files.create).not.toHaveBeenCalled();
    });

    it('rejects unsupported mime types', async () => {
      await expect(
        service.uploadAvatar(USER, makeFile({ mimetype: 'text/plain' })),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('rejects empty and oversized files', async () => {
      await expect(
        service.uploadAvatar(USER, makeFile({ size: 0 })),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      await expect(
        service.uploadAvatar(USER, makeFile({ size: 6 * 1024 * 1024 })),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });

  describe('getAvatar', () => {
    it('returns null when the user has no avatar', async () => {
      files.findByUserAndKind.mockResolvedValue(null);
      await expect(service.getAvatar(USER)).resolves.toBeNull();
    });

    it('returns the avatar with a url', async () => {
      files.findByUserAndKind.mockResolvedValue(fileRow);
      storage.getUrl.mockResolvedValue('https://storage/avatar-url');
      const result = await service.getAvatar(USER);
      expect(result).toMatchObject({
        id: fileRow.id,
        url: 'https://storage/avatar-url',
      });
    });
  });

  describe('deleteAvatar', () => {
    it('removes the file, its object, and the user reference', async () => {
      files.findByUserAndKind.mockResolvedValue(fileRow);
      await service.deleteAvatar(USER);
      expect(files.remove).toHaveBeenCalledWith(fileRow.id);
      expect(storage.delete).toHaveBeenCalledWith(fileRow.storageKey);
      expect(users.setAvatar).toHaveBeenCalledWith(USER, null);
    });

    it('is a no-op when there is no avatar', async () => {
      files.findByUserAndKind.mockResolvedValue(null);
      await service.deleteAvatar(USER);
      expect(files.remove).not.toHaveBeenCalled();
      expect(users.setAvatar).not.toHaveBeenCalled();
    });
  });
});
