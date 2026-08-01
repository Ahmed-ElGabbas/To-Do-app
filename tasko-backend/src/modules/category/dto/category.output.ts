/** Response shape for a category. Whitelisted by construction in CategoryService. */
export interface CategoryOutput {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
