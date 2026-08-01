import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLogEntity } from '../entities/activity-log.entity';
import {
  ActivityLogListOptions,
  ActivityLogRepository,
  CreateActivityLogData,
} from '../interfaces/activity-log-repository';

@Injectable()
export class TypeOrmActivityLogRepository extends ActivityLogRepository {
  constructor(
    @InjectRepository(ActivityLogEntity)
    private readonly repo: Repository<ActivityLogEntity>,
  ) {
    super();
  }

  findByEventId(eventId: string): Promise<ActivityLogEntity | null> {
    return this.repo.findOne({ where: { eventId } });
  }

  async listAndCount(
    userId: string,
    options: ActivityLogListOptions,
  ): Promise<[ActivityLogEntity[], number]> {
    const qb = this.repo
      .createQueryBuilder('log')
      .where('log.userId = :userId', { userId });

    if (options.type) {
      qb.andWhere('log.type = :type', { type: options.type });
    }

    const [items, total] = await qb
      .orderBy('log.createdAt', 'DESC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();
    return [items, total];
  }

  create(data: CreateActivityLogData): Promise<ActivityLogEntity> {
    return this.repo.save(this.repo.create(data));
  }
}
