/**
 * Lifecycle of a team invitation. A fresh invitation is PENDING; accepting or
 * declining resolves it, and the owner can revoke a pending one early.
 */
export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  REVOKED = 'revoked',
}
