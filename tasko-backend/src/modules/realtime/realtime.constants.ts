/**
 * Room-name and wire-event helpers for the realtime layer. Rooms are the only
 * addressing mechanism (Section 4 of the realtime plan): a per-user room for
 * personal-scope events and per-team rooms for team collaboration, mirroring
 * the nullable `team_id` discriminator of the data model.
 */

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function teamRoom(teamId: string): string {
  return `team:${teamId}`;
}

/** Socket.IO wire event names. */
export const REALTIME_EVENTS = {
  /** Error emitted on the wire before a rejected socket is disconnected. */
  AUTH_ERROR: 'auth_error',
  /** A task was created/updated/completed/reopened/deleted. */
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_COMPLETED: 'task.completed',
  TASK_REOPENED: 'task.reopened',
  TASK_DELETED: 'task.deleted',
  /** A comment was added to a task. */
  COMMENT_ADDED: 'comment.added',
  /** A team invitation was accepted. */
  INVITATION_ACCEPTED: 'invitation.accepted',
  /** A user was removed from a team (routed to the team room). */
  MEMBER_REMOVED: 'member.removed',
  /** Presence: a user's first socket connected / last socket disconnected. */
  USER_ONLINE: 'user.online',
  USER_OFFLINE: 'user.offline',
  /** Client→server: comment-typing indicator; relayed to the team room. */
  TYPING: 'typing',
  /** Generic wire error (e.g. `RATE_LIMITED`), mirrors the REST error codes. */
  ERROR: 'error',
} as const;
