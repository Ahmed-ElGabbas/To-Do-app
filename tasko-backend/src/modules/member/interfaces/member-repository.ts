import { TeamRole } from '../../../common/constants/team-role.enum';
import { TeamMemberEntity } from '../entities/team-member.entity';

/**
 * Data access contract for team memberships. The concrete TypeORM
 * implementation lives in `repositories/`; services and the global
 * TeamMembershipGuard only depend on this abstraction.
 */
export abstract class MemberRepository {
  abstract findById(id: string): Promise<TeamMemberEntity | null>;

  abstract findByTeamAndUser(
    teamId: string,
    userId: string,
  ): Promise<TeamMemberEntity | null>;

  abstract listByTeam(teamId: string): Promise<TeamMemberEntity[]>;

  abstract create(data: {
    teamId: string;
    userId: string;
    role: TeamRole;
  }): Promise<TeamMemberEntity>;

  abstract save(entity: TeamMemberEntity): Promise<TeamMemberEntity>;

  abstract remove(id: string): Promise<void>;
}
