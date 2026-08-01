import { TaskEntity } from '../entities/task.entity';
import { TaskOutput } from '../dto/task.output';

/** Maps a persisted task to its whitelisted response shape. */
export function toTaskOutput(task: TaskEntity): TaskOutput {
  return {
    id: task.id,
    title: task.title,
    time: task.time,
    date: task.date,
    isDone: task.isDone,
    priority: task.priority,
    notes: task.notes ?? null,
    teamId: task.teamId ?? null,
    categoryId: task.categoryId ?? null,
    tagIds: (task.tags ?? []).map((tag) => tag.id).sort(),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
