import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CategoryEntity } from '../entities/category.entity';
import { CategoryRepository } from '../interfaces/category-repository';

@Injectable()
export class TypeOrmCategoryRepository extends CategoryRepository {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly repo: Repository<CategoryEntity>,
  ) {
    super();
  }

  findById(id: string): Promise<CategoryEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByNameForUser(
    userId: string,
    name: string,
  ): Promise<CategoryEntity | null> {
    return this.repo
      .createQueryBuilder('category')
      .where('category.userId = :userId', { userId })
      .andWhere('category.teamId IS NULL')
      .andWhere('LOWER(category.name) = LOWER(:name)', { name })
      .getOne();
  }

  findByNameForTeam(
    teamId: string,
    name: string,
  ): Promise<CategoryEntity | null> {
    return this.repo
      .createQueryBuilder('category')
      .where('category.teamId = :teamId', { teamId })
      .andWhere('LOWER(category.name) = LOWER(:name)', { name })
      .getOne();
  }

  listByUser(userId: string): Promise<CategoryEntity[]> {
    return this.repo.find({
      where: { userId, teamId: IsNull() },
      order: { name: 'ASC' },
    });
  }

  listByTeam(teamId: string): Promise<CategoryEntity[]> {
    return this.repo.find({
      where: { teamId },
      order: { name: 'ASC' },
    });
  }

  create(data: {
    userId: string;
    teamId: string | null;
    name: string;
  }): Promise<CategoryEntity> {
    return this.repo.save(this.repo.create(data));
  }

  save(entity: CategoryEntity): Promise<CategoryEntity> {
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
