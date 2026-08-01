import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from '../entities/notification.entity';
import {
  CreateNotificationData,
  NotificationListOptions,
  NotificationRepository,
} from '../interfaces/notification-repository';

@Injectable()
export class TypeOrmNotificationRepository extends NotificationRepository {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly repo: Repository<NotificationEntity>,
  ) {
    super();
  }

  findByEventId(eventId: string): Promise<NotificationEntity | null> {
    return this.repo.findOne({ where: { eventId } });
  }

  findByIdAndUser(
    id: string,
    userId: string,
  ): Promise<NotificationEntity | null> {
    return this.repo.findOne({ where: { id, userId } });
  }

  async listAndCount(
    userId: string,
    options: NotificationListOptions,
  ): Promise<[NotificationEntity[], number]> {
    const qb = this.repo
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId });

    if (options.isRead !== undefined) {
      qb.andWhere('notification.isRead = :isRead', {
        isRead: options.isRead,
      });
    }

    const [items, total] = await qb
      .orderBy('notification.createdAt', 'DESC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getManyAndCount();
    return [items, total];
  }

  create(data: CreateNotificationData): Promise<NotificationEntity> {
    return this.repo.save(this.repo.create(data));
  }

  save(entity: NotificationEntity): Promise<NotificationEntity> {
    return this.repo.save(entity);
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.repo.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return result.affected ?? 0;
  }
}
