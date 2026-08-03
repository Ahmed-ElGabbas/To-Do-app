import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, SelectQueryBuilder } from 'typeorm';
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

  /**
   * Searches personal categories plus team categories the user can see.
   * Empty `teamIds` narrows the search to personal categories.
   */
  async searchForUser(
    userId: string,
    teamIds: string[],
    q: string,
    page: number,
    limit: number,
  ): Promise<[CategoryEntity[], number]> {
    const build = (): SelectQueryBuilder<CategoryEntity> => {
      const qb = this.repo.createQueryBuilder('category');
      if (teamIds.length > 0) {
        qb.where(
          '((category.userId = :userId AND category.teamId IS NULL) OR category.teamId IN (:...teamIds))',
          { userId, teamIds },
        );
      } else {
        qb.where('category.userId = :userId AND category.teamId IS NULL', {
          userId,
        });
      }
      return qb.andWhere('LOWER(category.name) LIKE LOWER(:q)', {
        q: `%${q}%`,
      });
    };

    const total = await build().getCount();
    const items = await build()
      .orderBy('category.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    return [items, total];
  }

  save(entity: CategoryEntity): Promise<CategoryEntity> {
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
