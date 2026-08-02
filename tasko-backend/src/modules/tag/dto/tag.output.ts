/** Response shape for a tag. Whitelisted by construction in TagService. */
export interface TagOutput {
  id: string;
  name: string;
  /** Set for team-scoped tags; null for personal ones. */
  teamId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
