import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamRole } from '../../../common/constants/team-role.enum';
import { TeamEntity } from '../entities/team.entity';
import { TeamMemberEntity } from '../../member/entities/team-member.entity';
import { TeamRepository } from '../interfaces/team-repository';

@Injectable()
export class TypeOrmTeamRepository extends TeamRepository {
  constructor(
    @InjectRepository(TeamEntity)
    private readonly repo: Repository<TeamEntity>,
  ) {
    super();
  }

  findById(id: string): Promise<TeamEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  /**
   * Creates the team and its owner's OWNER membership in a single transaction
   * so a team never exists without its owner.
   */
  async create(data: {
    ownerId: string;
    name: string;
    description: string | null;
  }): Promise<TeamEntity> {
    return this.repo.manager.transaction(async (manager) => {
      const team = await manager.save(manager.create(TeamEntity, data));
      await manager.save(
        manager.create(TeamMemberEntity, {
          teamId: team.id,
          userId: data.ownerId,
          role: TeamRole.OWNER,
        }),
      );
      return team;
    });
  }

  save(entity: TeamEntity): Promise<TeamEntity> {
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    // Members, tasks, categories and tags referencing the team are removed by
    // their FK ON DELETE CASCADE.
    await this.repo.delete(id);
  }

  listForMember(
    userId: string,
  ): Promise<Array<{ team: TeamEntity; role: TeamRole }>> {
    return this.repo
      .createQueryBuilder('team')
      .innerJoin(
        TeamMemberEntity,
        'membership',
        'membership.teamId = team.id AND membership.userId = :userId',
        { userId },
      )
      .addSelect('membership.role', 'role')
      .orderBy('team.name', 'ASC')
      .getRawAndEntities<TeamEntity>()
      .then(({ entities, raw }) =>
        entities.map((team, index) => ({
          team,
          role: raw[index]?.role as TeamRole,
        })),
      );
  }
}
