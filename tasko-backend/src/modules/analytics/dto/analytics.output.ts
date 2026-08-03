import { TaskPriority } from '../../../common/constants/task-priority.enum';

/** Count of tasks per category (null categoryId = tasks without a category). */
export interface AnalyticsByCategory {
  categoryId: string | null;
  name: string | null;
  total: number;
  completed: number;
}

/** Completed-task count for a single calendar day (yyyy-MM-dd). */
export interface AnalyticsTrendPoint {
  date: string;
  completed: number;
}

/** One summary object returned by the analytics endpoints. */
export interface AnalyticsSummary {
  total: number;
  completed: number;
  pending: number;
  /** Percentage 0-100 with one decimal place (0 when there are no tasks). */
  completionRate: number;
  /** Not-done tasks whose ISO date is strictly before today. */
  overdue: number;
  byPriority: Record<TaskPriority, number>;
  byCategory: AnalyticsByCategory[];
  /** Completed-task counts for the trailing 7 days, oldest first. */
  completionTrend: AnalyticsTrendPoint[];
}
