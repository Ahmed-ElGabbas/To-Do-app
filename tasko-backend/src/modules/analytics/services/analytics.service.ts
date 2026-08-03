import { Injectable } from '@nestjs/common';
import { TaskPriority } from '../../../common/constants/task-priority.enum';
import {
  AnalyticsRow,
  TaskRepository,
} from '../../task/interfaces/task-repository';
import { AnalyticsSummary } from '../dto/analytics.output';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TREND_DAYS = 7;

/**
 * Computes task analytics. The repository returns a lightweight projection of
 * every task in scope; aggregation happens here so it stays a pure function of
 * the rows and is easy to unit test. Personal (`personal`) and team (`team`)
 * summaries share the same computation.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly tasks: TaskRepository) {}

  async personal(userId: string): Promise<AnalyticsSummary> {
    return this.summarize(await this.tasks.listForAnalytics({ userId }));
  }

  async team(teamId: string): Promise<AnalyticsSummary> {
    return this.summarize(await this.tasks.listForAnalytics({ teamId }));
  }

  private summarize(rows: AnalyticsRow[]): AnalyticsSummary {
    const total = rows.length;
    const completed = rows.filter((row) => row.isDone).length;
    const pending = total - completed;
    const todayIso = toIsoDate(new Date());

    const byPriority: Record<TaskPriority, number> = {
      [TaskPriority.HIGH]: 0,
      [TaskPriority.MEDIUM]: 0,
      [TaskPriority.LOW]: 0,
    };
    for (const row of rows) {
      byPriority[row.priority] += 1;
    }

    const byCategoryMap = new Map<
      string,
      {
        categoryId: string | null;
        name: string | null;
        total: number;
        completed: number;
      }
    >();
    for (const row of rows) {
      const key = row.categoryId ?? '__none__';
      const entry = byCategoryMap.get(key) ?? {
        categoryId: row.categoryId,
        name: row.categoryName,
        total: 0,
        completed: 0,
      };
      entry.total += 1;
      if (row.isDone) {
        entry.completed += 1;
      }
      byCategoryMap.set(key, entry);
    }
    const byCategory = [...byCategoryMap.values()].sort(
      (a, b) => b.total - a.total,
    );

    const completionTrend = trailingDates(TREND_DAYS).map((date) => ({
      date,
      completed: rows.filter(
        (row) =>
          row.isDone &&
          row.completedAt !== null &&
          toIsoDate(row.completedAt) === date,
      ).length,
    }));

    return {
      total,
      completed,
      pending,
      completionRate:
        total === 0 ? 0 : Math.round((completed / total) * 1000) / 10,
      overdue: rows.filter(
        (row) =>
          !row.isDone && ISO_DATE_PATTERN.test(row.date) && row.date < todayIso,
      ).length,
      byPriority,
      byCategory,
      completionTrend,
    };
  }
}

/** Returns the last `days` local calendar dates, oldest first (today last). */
function trailingDates(days: number): string[] {
  const dates: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const copy = new Date();
    copy.setDate(copy.getDate() - offset);
    dates.push(toIsoDate(copy));
  }
  return dates;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
