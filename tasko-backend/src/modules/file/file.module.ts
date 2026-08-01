import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { UserModule } from '../user/user.module';
import { FileController } from './controllers/file.controller';
import { FileEntity } from './entities/file.entity';
import { FileRepository } from './interfaces/file-repository';
import { TypeOrmFileRepository } from './repositories/typeorm-file.repository';
import { FileService } from './services/file.service';

@Module({
  imports: [TypeOrmModule.forFeature([FileEntity]), UserModule, StorageModule],
  controllers: [FileController],
  providers: [
    FileService,
    { provide: FileRepository, useClass: TypeOrmFileRepository },
  ],
})
export class FileModule {}
