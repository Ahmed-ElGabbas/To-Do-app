import { ConfigService } from '@nestjs/config';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { UnauthorizedError } from '../../common/errors/domain-error';
import { LoggerService } from '../../common/logger/logger.service';
import { FirebaseAdminService } from './firebase-admin.service';

describe('FirebaseAdminService', () => {
  const logger = {
    setContext: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    verbose: jest.fn(),
    fatal: jest.fn(),
  };

  const makeConfig = (overrides: Record<string, string> = {}) => ({
    get: jest.fn((key: string, fallback?: unknown) => {
      const map: Record<string, string> = {
        'firebase.projectId': '',
        'firebase.serviceAccountPath': '',
        'firebase.serviceAccountJson': '',
        ...overrides,
      };
      return key in map ? map[key] : fallback;
    }),
  });

  const stubApp = { name: '[DEFAULT]' } as never;

  const buildService = (config: Record<string, string>) =>
    new FirebaseAdminService(
      makeConfig(config) as unknown as ConfigService,
      logger as unknown as LoggerService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects with 401 when Firebase is not configured', async () => {
    const service = buildService({});

    await expect(service.verifyIdToken('token')).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(getAuth).not.toHaveBeenCalled();
  });

  it('initializes lazily and verifies the first token', async () => {
    getApps.mockReturnValue([]);
    initializeApp.mockReturnValue(stubApp);
    getAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'u1' }),
    });

    const service = buildService({
      'firebase.projectId': 'tasko-test',
      'firebase.serviceAccountJson': Buffer.from(
        JSON.stringify({ client_email: 'a@b', private_key: 'k' }),
      ).toString('base64'),
    });

    await expect(service.verifyIdToken('token')).resolves.toEqual({
      uid: 'u1',
    });
    await service.verifyIdToken('token');

    expect(initializeApp).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('firebase_admin_initialized', {
      projectId: 'tasko-test',
    });
  });

  it('wraps SDK verification errors as 401', async () => {
    getApps.mockReturnValue([]);
    initializeApp.mockReturnValue(stubApp);
    getAuth.mockReturnValue({
      verifyIdToken: jest
        .fn()
        .mockRejectedValue(new Error('Firebase ID token has expired')),
    });

    const service = buildService({
      'firebase.projectId': 'tasko-test',
      'firebase.serviceAccountJson': '{}',
    });

    await expect(service.verifyIdToken('bad-token')).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(logger.warn).toHaveBeenCalledWith('firebase_id_token_rejected', {
      message: expect.any(String),
    });
  });

  it('rejects cleanly when a configured service-account file is missing', async () => {
    getApps.mockReturnValue([]);
    initializeApp.mockReturnValue(stubApp);
    getAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'u2' }),
    });

    const service = buildService({
      'firebase.projectId': 'tasko-test',
      'firebase.serviceAccountPath': './nonexistent.json',
    });

    // A missing file must surface as an unauthorized error (not a crash).
    await expect(service.verifyIdToken('token')).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});
