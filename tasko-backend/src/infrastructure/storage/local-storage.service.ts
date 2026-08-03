import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { StorageService } from './storage.service';

/**
 * Disk-backed storage used for development and tests. Object URLs point at a
 * static uploads endpoint under the app base URL. This is intentionally NOT
 * the production path — production uses S3-compatible object storage.
 */
@Injectable()
export class LocalStorageService extends StorageService {
  private readonly rootDir: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    super();
    this.rootDir = config.get<string>('storage.dir', './storage');
    this.baseUrl = config.get<string>('app.baseUrl', 'http://localhost:3000');
  }

  async save(key: string, data: Buffer): Promise<void> {
    const filePath = this.resolvePath(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
  }

  async getUrl(key: string): Promise<string> {
    return `${this.baseUrl}/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolvePath(key));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Confines keys to the upload root and rejects path traversal. Keys are
   * server-generated, so this is defense in depth rather than the only check.
   */
  private resolvePath(key: string): string {
    const normalized = key.replace(/\\/g, '/');
    const safe = normalized.startsWith('/') ? normalized.slice(1) : normalized;
    if (safe.includes('..') || safe.includes(':')) {
      throw new Error(`Refusing unsafe storage key: ${key}`);
    }
    return resolve(this.rootDir, safe.split('/').join(sep));
  }
}
