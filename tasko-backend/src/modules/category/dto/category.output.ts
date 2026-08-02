/** Response shape for a category. Whitelisted by construction in CategoryService. */
export interface CategoryOutput {
  id: string;
  name: string;
  /** Set for team-scoped categories; null for personal ones. */
  teamId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
