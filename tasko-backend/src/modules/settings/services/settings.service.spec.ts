import { Test } from '@nestjs/testing';
import { AppLanguage } from '../../../common/constants/app-language.enum';
import { UserSettingsRepository } from '../interfaces/user-settings-repository';
import { SettingsService } from './settings.service';

const USER = '11111111-1111-4111-8111-111111111111';

describe('SettingsService', () => {
  const repo = {
    findByUserId: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  let service: SettingsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: UserSettingsRepository, useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(SettingsService);
  });

  const row = {
    id: '33333333-3333-4333-8333-333333333333',
    userId: USER,
    darkMode: false,
    notificationsEnabled: true,
    language: AppLanguage.EN,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('getOrCreate', () => {
    it('returns existing settings', async () => {
      repo.findByUserId.mockResolvedValue(row);
      const result = await service.getOrCreate(USER);
      expect(result).toMatchObject({
        userId: USER,
        darkMode: false,
        language: AppLanguage.EN,
      });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('creates defaults when no row exists yet', async () => {
      repo.findByUserId.mockResolvedValue(null);
      repo.create.mockResolvedValue(row);
      const result = await service.getOrCreate(USER);
      expect(repo.create).toHaveBeenCalledWith({
        userId: USER,
        darkMode: false,
        notificationsEnabled: true,
        language: AppLanguage.EN,
      });
      expect(result.userId).toBe(USER);
    });
  });

  describe('update', () => {
    it('updates partial fields only', async () => {
      repo.findByUserId.mockResolvedValue(row);
      repo.save.mockResolvedValue({ ...row, darkMode: true });

      const result = await service.update(USER, { darkMode: true });

      expect(repo.save).toHaveBeenCalled();
      expect(result.darkMode).toBe(true);
      expect(result.language).toBe(AppLanguage.EN);
    });

    it('creates the row first when absent', async () => {
      repo.findByUserId.mockResolvedValue(null);
      repo.create.mockResolvedValue(row);
      repo.save.mockResolvedValue({ ...row, language: AppLanguage.AR });

      const result = await service.update(USER, { language: AppLanguage.AR });
      expect(repo.create).toHaveBeenCalled();
      expect(result.language).toBe(AppLanguage.AR);
    });
  });
});
