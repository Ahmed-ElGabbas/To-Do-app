/** Response shape for a tag. Whitelisted by construction in TagService. */
export interface TagOutput {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
