/** Response shape for a single activity log entry. */
export interface ActivityLogOutput {
  id: string;
  type: string;
  entityId: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}
