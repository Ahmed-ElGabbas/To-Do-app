import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { TagEntity } from '../entities/tag.entity';
import { TagRepository } from '../interfaces/tag-repository';

@Injectable()
export class TypeOrmTagRepository extends TagRepository {
  constructor(
    @InjectRepository(TagEntity)
    private readonly repo: Repository<TagEntity>,
  ) {
    super();
  }

  findById(id: string): Promise<TagEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByNameForUser(userId: string, name: string): Promise<TagEntity | null> {
    return this.repo
      .createQueryBuilder('tag')
      .where('tag.userId = :userId', { userId })
      .andWhere('tag.teamId IS NULL')
      .andWhere('LOWER(tag.name) = LOWER(:name)', { name })
      .getOne();
  }

  findByNameForTeam(teamId: string, name: string): Promise<TagEntity | null> {
    return this.repo
      .createQueryBuilder('tag')
      .where('tag.teamId = :teamId', { teamId })
      .andWhere('LOWER(tag.name) = LOWER(:name)', { name })
      .getOne();
  }

  listByUser(userId: string): Promise<TagEntity[]> {
    return this.repo.find({
      where: { userId, teamId: IsNull() },
      order: { name: 'ASC' },
    });
  }

  listByTeam(teamId: string): Promise<TagEntity[]> {
    return this.repo.find({ where: { teamId }, order: { name: 'ASC' } });
  }

  findByIdsForUser(userId: string, ids: string[]): Promise<TagEntity[]> {
    return this.repo.find({
      where: { id: In(ids), userId, teamId: IsNull() },
    });
  }

  findByIdsForTeam(teamId: string, ids: string[]): Promise<TagEntity[]> {
    return this.repo.find({ where: { id: In(ids), teamId } });
  }

  create(data: {
    userId: string;
    teamId: string | null;
    name: string;
  }): Promise<TagEntity> {
    return this.repo.save(this.repo.create(data));
  }

  save(entity: TagEntity): Promise<TagEntity> {
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
