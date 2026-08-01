import { ActivityLogEntity } from '../entities/activity-log.entity';
import { ActivityLogOutput } from './activity-log.output';

/** Maps a persisted activity log entry to its whitelisted response shape. */
export function toActivityLogOutput(log: ActivityLogEntity): ActivityLogOutput {
  return {
    id: log.id,
    type: log.type,
    entityId: log.entityId,
    summary: log.summary,
    metadata: log.metadata ?? null,
    createdAt: log.createdAt,
  };
}
