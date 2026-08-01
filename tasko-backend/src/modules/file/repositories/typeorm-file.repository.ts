import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileKind } from '../../../common/constants/file-kind.enum';
import { FileEntity } from '../entities/file.entity';
import { CreateFileData, FileRepository } from '../interfaces/file-repository';

@Injectable()
export class TypeOrmFileRepository extends FileRepository {
  constructor(
    @InjectRepository(FileEntity)
    private readonly repo: Repository<FileEntity>,
  ) {
    super();
  }

  findById(id: string): Promise<FileEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByUserAndKind(
    userId: string,
    kind: FileKind,
  ): Promise<FileEntity | null> {
    return this.repo.findOne({ where: { userId, kind } });
  }

  create(data: CreateFileData): Promise<FileEntity> {
    return this.repo.save(this.repo.create(data));
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
