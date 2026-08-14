import { CommentOutput } from '../../comment/dto/comment.output';

/**
 * Wire envelope for every server→client realtime event (Section 3.4 of the
 * realtime plan). This is NOT the HTTP `{ success, data }` envelope — sockets
 * carry `eventId`/`occurredAt`/`actor` so clients can dedupe and attribute.
 * `payload` reuses the exact REST output DTO shapes (TaskOutput, CommentOutput)
 * so the client models one class per entity across both transports.
 */
export interface RealtimeEnvelope<T> {
  /** The TaskEvent.id — dedup/logging key. */
  eventId: string;
  /** ISO-8601 timestamp from the originating domain event. */
  occurredAt: string;
  /** The user whose action produced the event. */
  actor: { userId: string };
  payload: T;
}

export interface TaskDeletedPayload {
  taskId: string;
  title: string;
  teamId?: string;
}

export interface CommentAddedPayload {
  comment: CommentOutput;
  task: { id: string; title: string };
}

export interface InvitationAcceptedPayload {
  teamId: string;
  invitedEmail: string;
  invitedBy: { userId: string };
}

export interface MemberRemovedPayload {
  teamId: string;
  userId: string;
}
