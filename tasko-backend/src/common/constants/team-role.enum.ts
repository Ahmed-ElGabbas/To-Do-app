/**
 * Roles a user can hold inside a team. Hierarchy (highest to lowest):
 * owner > editor > viewer. Write operations require `editor` or higher;
 * team administration (members, rename, delete) requires `owner`.
 */
export enum TeamRole {
  OWNER = 'owner',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}
