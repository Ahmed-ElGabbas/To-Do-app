import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { FileKind } from '../../../common/constants/file-kind.enum';
import { ValidationError } from '../../../common/errors/domain-error';
import { StorageService } from '../../../infrastructure/storage/storage.service';
import { UserService } from '../../user/user.service';
import { FileOutput } from '../dto/file.output';
import { FileEntity } from '../entities/file.entity';
import { FileRepository } from '../interfaces/file-repository';

/** Image types accepted for avatars (mirrors common avatar constraints). */
export const ALLOWED_AVATAR_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

@Injectable()
export class FileService {
  private readonly maxFileSizeBytes: number;

  constructor(
    private readonly files: FileRepository,
    private readonly storage: StorageService,
    private readonly users: UserService,
    config: ConfigService,
  ) {
    this.maxFileSizeBytes = config.get<number>(
      'storage.maxFileSizeBytes',
      5 * 1024 * 1024,
    );
  }

  /**
   * Stores an avatar, keeps one avatar per user (previous one is removed), and
   * points the user's `avatarFileId` at the new file.
   */
  async uploadAvatar(
    userId: string,
    file: Express.Multer.File | undefined,
  ): Promise<FileOutput> {
    this.assertUpload(file);
    const previous = await this.files.findByUserAndKind(
      userId,
      FileKind.AVATAR,
    );

    const storageKey = this.buildStorageKey(userId, file);
    await this.storage.save(storageKey, file.buffer, file.mimetype);

    const created = await this.files.create({
      userId,
      kind: FileKind.AVATAR,
      mimeType: file.mimetype,
      size: file.size,
      originalName: file.originalname,
      storageKey,
    });

    if (previous) {
      await this.files.remove(previous.id);
      await this.storage.delete(previous.storageKey);
    }
    await this.users.setAvatar(userId, created.id);

    return this.toOutput(
      created,
      await this.storage.getUrl(created.storageKey),
    );
  }

  async getAvatar(userId: string): Promise<FileOutput | null> {
    const file = await this.files.findByUserAndKind(userId, FileKind.AVATAR);
    if (!file) {
      return null;
    }
    return this.toOutput(file, await this.storage.getUrl(file.storageKey));
  }

  async deleteAvatar(userId: string): Promise<void> {
    const file = await this.files.findByUserAndKind(userId, FileKind.AVATAR);
    if (!file) {
      return;
    }
    await this.files.remove(file.id);
    await this.storage.delete(file.storageKey);
    await this.users.setAvatar(userId, null);
  }

  /** Defense in depth; the interceptor already filters MIME and size. */
  private assertUpload(
    file: Express.Multer.File | undefined,
  ): asserts file is Express.Multer.File {
    if (!file) {
      throw new ValidationError('No file was uploaded');
    }
    if (!ALLOWED_AVATAR_MIME_TYPES.has(file.mimetype)) {
      throw new ValidationError(`Unsupported file type: ${file.mimetype}`);
    }
    if (file.size <= 0) {
      throw new ValidationError('Uploaded file is empty');
    }
    if (file.size > this.maxFileSizeBytes) {
      throw new ValidationError(
        `File exceeds the ${this.maxFileSizeBytes / (1024 * 1024)} MB limit`,
      );
    }
  }

  private buildStorageKey(userId: string, file: Express.Multer.File): string {
    const ext = extname(file.originalname).toLowerCase() || '';
    return `avatars/${userId}/${randomUUID()}${ext}`;
  }

  private toOutput(file: FileEntity, url: string): FileOutput {
    return {
      id: file.id,
      kind: file.kind,
      mimeType: file.mimeType,
      size: file.size,
      originalName: file.originalName,
      url,
      createdAt: file.createdAt,
    };
  }
}
