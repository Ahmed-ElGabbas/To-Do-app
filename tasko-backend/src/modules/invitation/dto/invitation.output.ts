import { TeamRole } from '../../../common/constants/team-role.enum';
import { InvitationStatus } from '../constants/invitation-status.enum';
import { InvitationEntity } from '../entities/invitation.entity';

/** Whitelisted invitation projection returned to API clients. */
export interface InvitationOutput {
  id: string;
  teamId: string;
  teamName: string;
  email: string;
  role: TeamRole;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
}

export function toInvitationOutput(
  invitation: InvitationEntity,
  teamName: string,
): InvitationOutput {
  return {
    id: invitation.id,
    teamId: invitation.teamId,
    teamName,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
}
