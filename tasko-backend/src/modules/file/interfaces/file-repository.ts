import { FileKind } from '../../../common/constants/file-kind.enum';
import { FileEntity } from '../entities/file.entity';

export interface CreateFileData {
  userId: string;
  kind: FileKind;
  mimeType: string;
  size: number;
  originalName: string;
  storageKey: string;
}

/** Data access contract for stored files. */
export abstract class FileRepository {
  abstract findById(id: string): Promise<FileEntity | null>;

  abstract findByUserAndKind(
    userId: string,
    kind: FileKind,
  ): Promise<FileEntity | null>;

  abstract create(data: CreateFileData): Promise<FileEntity>;

  abstract remove(id: string): Promise<void>;
}
