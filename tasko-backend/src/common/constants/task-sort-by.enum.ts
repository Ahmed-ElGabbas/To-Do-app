/** Allowed task listing sort fields. */
export enum TaskSortBy {
  CREATED_AT = 'createdAt',
  PRIORITY = 'priority',
  TITLE = 'title',
}

export type TaskSortDir = 'ASC' | 'DESC';
