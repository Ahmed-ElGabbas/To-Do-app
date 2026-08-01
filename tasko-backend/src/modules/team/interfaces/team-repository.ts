import { TeamRole } from '../../../common/constants/team-role.enum';
import { TeamEntity } from '../entities/team.entity';

/**
 * Data access contract for teams. The concrete TypeORM implementation lives in
 * `repositories/`; services only depend on this abstraction.
 */
export abstract class TeamRepository {
  abstract findById(id: string): Promise<TeamEntity | null>;

  abstract create(data: {
    ownerId: string;
    name: string;
    description: string | null;
  }): Promise<TeamEntity>;

  abstract save(entity: TeamEntity): Promise<TeamEntity>;

  abstract remove(id: string): Promise<void>;

  /** Lists teams the user belongs to, with their role in each. */
  abstract listForMember(
    userId: string,
  ): Promise<Array<{ team: TeamEntity; role: TeamRole }>>;
}
