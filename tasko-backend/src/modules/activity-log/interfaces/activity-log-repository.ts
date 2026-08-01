import { ActivityLogEntity } from '../entities/activity-log.entity';

export interface ActivityLogListOptions {
  page: number;
  limit: number;
  type?: string;
}

export interface CreateActivityLogData {
  userId: string;
  eventId: string;
  type: string;
  entityId: string;
  summary: string;
  metadata: Record<string, unknown> | null;
}

/** Data access contract for the append-only activity log. */
export abstract class ActivityLogRepository {
  abstract findByEventId(eventId: string): Promise<ActivityLogEntity | null>;

  abstract listAndCount(
    userId: string,
    options: ActivityLogListOptions,
  ): Promise<[ActivityLogEntity[], number]>;

  abstract create(data: CreateActivityLogData): Promise<ActivityLogEntity>;
}
