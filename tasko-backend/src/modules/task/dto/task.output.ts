import { TaskPriority } from '../../../common/constants/task-priority.enum';

/** Response shape for a task. Whitelisted by construction in `toTaskOutput`. */
export interface TaskOutput {
  id: string;
  title: string;
  time: string;
  date: string;
  isDone: boolean;
  priority: TaskPriority;
  notes: string | null;
  /** Set for team-scoped tasks; null for personal tasks. */
  teamId: string | null;
  categoryId: string | null;
  tagIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
