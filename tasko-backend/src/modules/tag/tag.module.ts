import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TagController } from './controllers/tag.controller';
import { TeamTagController } from './controllers/team-tag.controller';
import { TagEntity } from './entities/tag.entity';
import { TagRepository } from './interfaces/tag-repository';
import { TypeOrmTagRepository } from './repositories/typeorm-tag.repository';
import { TagService } from './services/tag.service';

@Module({
  imports: [TypeOrmModule.forFeature([TagEntity])],
  controllers: [TagController, TeamTagController],
  providers: [
    TagService,
    { provide: TagRepository, useClass: TypeOrmTagRepository },
  ],
  exports: [TagRepository],
})
export class TagModule {}
