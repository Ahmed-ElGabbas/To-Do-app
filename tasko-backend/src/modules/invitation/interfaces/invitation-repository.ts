import { TeamRole } from '../../../common/constants/team-role.enum';
import { InvitationEntity } from '../entities/invitation.entity';

export interface CreateInvitationData {
  teamId: string;
  email: string;
  tokenHash: string;
  role: TeamRole;
  invitedBy: string;
  expiresAt: Date;
}

/**
 * Data access contract for team invitations. The concrete TypeORM
 * implementation lives in `repositories/`; services depend only on this
 * abstraction so they stay testable and decoupled from the database.
 */
export abstract class InvitationRepository {
  abstract findById(id: string): Promise<InvitationEntity | null>;

  abstract findByTokenHash(tokenHash: string): Promise<InvitationEntity | null>;

  abstract findPendingByTeamAndEmail(
    teamId: string,
    email: string,
  ): Promise<InvitationEntity | null>;

  abstract listByTeam(teamId: string): Promise<InvitationEntity[]>;

  abstract create(data: CreateInvitationData): Promise<InvitationEntity>;

  abstract save(entity: InvitationEntity): Promise<InvitationEntity>;
}
