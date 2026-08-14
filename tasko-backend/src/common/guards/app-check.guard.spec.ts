import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirebaseAdminService } from '../../infrastructure/firebase/firebase-admin.service';
import { UnauthorizedError } from '../errors/domain-error';
import { LoggerService } from '../logger/logger.service';
import { AppCheckGuard } from './app-check.guard';

const TOKEN = 'app-check-token';

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    correlationId: 'corr-123',
    method: 'GET',
    path: '/tasks',
    headers: {},
    ...overrides,
  };
}

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => jest.fn(),
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AppCheckGuard', () => {
  const firebase = {
    isConfigured: jest.fn(),
    getAppCheck: jest.fn(),
  };
  const config = { get: jest.fn() };
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

  let guard: AppCheckGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    firebase.isConfigured.mockReturnValue(true);
    firebase.getAppCheck.mockReturnValue({ verifyToken: jest.fn() });
    config.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'appCheck.enforce' ? false : fallback,
    );
    guard = new AppCheckGuard(
      firebase as unknown as FirebaseAdminService,
      config as unknown as ConfigService,
      logger as unknown as LoggerService,
    );
  });

  it('skips entirely when Firebase is not configured (no logging)', async () => {
    firebase.isConfigured.mockReturnValue(false);

    await expect(guard.canActivate(makeContext(makeRequest()))).resolves.toBe(
      true,
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(firebase.getAppCheck).not.toHaveBeenCalled();
  });

  it('skips infra/crawler paths without logging', async () => {
    for (const path of [
      '/health',
      '/health/ready',
      '/.well-known/assetlinks.json',
      '/.well-known/apple-app-site-association',
    ]) {
      await expect(
        guard.canActivate(makeContext(makeRequest({ path }))),
      ).resolves.toBe(true);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    }
  });

  it('monitor mode allows and logs a missing token', async () => {
    await expect(guard.canActivate(makeContext(makeRequest()))).resolves.toBe(
      true,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'app_check_missing',
      expect.objectContaining({
        correlationId: 'corr-123',
        method: 'GET',
        path: '/tasks',
        enforce: false,
      }),
    );
  });

  it('monitor mode allows and logs a valid token', async () => {
    firebase.getAppCheck.mockReturnValue({
      verifyToken: jest.fn().mockResolvedValue({ appId: '1:123:android:abc' }),
    });

    await expect(
      guard.canActivate(
        makeContext(
          makeRequest({ headers: { 'x-firebase-app-check': TOKEN } }),
        ),
      ),
    ).resolves.toBe(true);
    expect(firebase.getAppCheck().verifyToken).toHaveBeenCalledWith(TOKEN);
    expect(logger.info).toHaveBeenCalledWith(
      'app_check_pass',
      expect.objectContaining({ appId: '1:123:android:abc' }),
    );
  });

  it('monitor mode allows and logs an invalid token (critical: never blocks)', async () => {
    firebase.getAppCheck.mockReturnValue({
      verifyToken: jest
        .fn()
        .mockRejectedValue(new Error('App Check token has expired')),
    });

    await expect(
      guard.canActivate(
        makeContext(
          makeRequest({ headers: { 'x-firebase-app-check': 'bad' } }),
        ),
      ),
    ).resolves.toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      'app_check_reject',
      expect.objectContaining({
        enforce: false,
        message: 'App Check token has expired',
      }),
    );
  });

  it('monitor mode allows a non-string token header', async () => {
    await expect(
      guard.canActivate(
        makeContext(
          makeRequest({ headers: { 'x-firebase-app-check': ['a', 'b'] } }),
        ),
      ),
    ).resolves.toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      'app_check_missing',
      expect.objectContaining({ path: '/tasks' }),
    );
  });

  it('enforce mode rejects a missing token', async () => {
    config.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'appCheck.enforce' ? true : fallback,
    );

    await expect(
      guard.canActivate(makeContext(makeRequest())),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('enforce mode rejects an invalid token', async () => {
    config.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'appCheck.enforce' ? true : fallback,
    );
    firebase.getAppCheck.mockReturnValue({
      verifyToken: jest.fn().mockRejectedValue(new Error('expired')),
    });

    await expect(
      guard.canActivate(
        makeContext(
          makeRequest({ headers: { 'x-firebase-app-check': 'bad' } }),
        ),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('enforce mode allows a valid token', async () => {
    config.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'appCheck.enforce' ? true : fallback,
    );
    firebase.getAppCheck.mockReturnValue({
      verifyToken: jest.fn().mockResolvedValue({ appId: 'x' }),
    });

    await expect(
      guard.canActivate(
        makeContext(
          makeRequest({ headers: { 'x-firebase-app-check': TOKEN } }),
        ),
      ),
    ).resolves.toBe(true);
  });
});
