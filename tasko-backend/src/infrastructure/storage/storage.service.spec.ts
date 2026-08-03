import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';
import { StorageModule } from './storage.module';
import { StorageService } from './storage.service';

describe('LocalStorageService', () => {
  let dir: string;
  let service: LocalStorageService;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tasko-storage-'));
    service = new LocalStorageService(
      new ConfigService({
        storage: { dir },
        app: { baseUrl: 'http://localhost:3000' },
      }),
    );
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes files under the upload root, creating parent directories', async () => {
    await service.save('avatars/u1/a.png', Buffer.from('bytes'), 'image/png');
    const file = join(dir, 'avatars', 'u1', 'a.png');
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe('bytes');
  });

  it('returns a URL under the app base URL', async () => {
    await expect(service.getUrl('avatars/u1/a.png')).resolves.toBe(
      'http://localhost:3000/uploads/avatars/u1/a.png',
    );
  });

  it('deletes an existing object and treats missing objects as success', async () => {
    await service.save('k', Buffer.from('x'), 'text/plain');
    await service.delete('k');
    expect(existsSync(join(dir, 'k'))).toBe(false);
    await expect(service.delete('k')).resolves.toBeUndefined();
  });

  it('rejects path traversal in keys', async () => {
    await expect(
      service.save('../evil', Buffer.from('x'), 'text/plain'),
    ).rejects.toThrow('Refusing unsafe storage key');
    await expect(
      service.save('a/../../evil', Buffer.from('x'), 'text/plain'),
    ).rejects.toThrow('Refusing unsafe storage key');
  });

  it('rejects drive-qualified keys', async () => {
    await expect(
      service.save('C:evil', Buffer.from('x'), 'text/plain'),
    ).rejects.toThrow('Refusing unsafe storage key');
  });
});

describe('StorageModule', () => {
  it('provides LocalStorageService when the driver is local', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [StorageModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string, fallback?: unknown) =>
          key === 'storage.driver' ? 'local' : fallback,
      })
      .compile();
    const storage = moduleRef.get(StorageService);
    expect(storage).toBeInstanceOf(LocalStorageService);
  });

  it('provides S3StorageService when the driver is s3', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [StorageModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string, fallback?: unknown) =>
          key === 'storage.driver' ? 's3' : fallback,
      })
      .compile();
    const storage = moduleRef.get(StorageService);
    expect(storage).toBeInstanceOf(S3StorageService);
  });
});
