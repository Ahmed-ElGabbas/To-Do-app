import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
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
      .getRawAndEntities<{ role: TeamRole }>()
      .then(({ entities, raw }) =>
        entities.map((team, index) => ({
          team,
          role: raw[index]?.role ?? TeamRole.VIEWER,
        })),
      );
  }

  /**
   * Searches team name/description for a member. The membership join already
   * scopes results to teams the user can see; an optional `teamId` narrows to
   * a single team (whose membership the caller already validated).
   */
  async searchForMember(
    userId: string,
    q: string,
    options: { teamId?: string; page: number; limit: number },
  ): Promise<[TeamEntity[], number]> {
    const build = (): SelectQueryBuilder<TeamEntity> => {
      const qb = this.repo
        .createQueryBuilder('team')
        .innerJoin(
          TeamMemberEntity,
          'membership',
          'membership.teamId = team.id AND membership.userId = :userId',
          { userId },
        );
      if (options.teamId) {
        qb.andWhere('team.id = :teamId', { teamId: options.teamId });
      }
      return qb.andWhere(
        '(LOWER(team.name) LIKE LOWER(:q) OR LOWER(team.description) LIKE LOWER(:q))',
        { q: `%${q}%` },
      );
    };

    const total = (await build().select('team.id').distinct(true).getRawMany())
      .length;

    const items = await build()
      .orderBy('team.name', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit)
      .getMany();

    return [items, total];
  }

  /**
   * Admin: paginates every team on the platform, optionally matching the
   * name/description. Not scoped to any membership.
   */
  async listAllForAdmin(
    q: string | undefined,
    page: number,
    limit: number,
  ): Promise<[TeamEntity[], number]> {
    const build = (): SelectQueryBuilder<TeamEntity> => {
      const qb = this.repo.createQueryBuilder('team');
      if (q) {
        qb.where(
          '(LOWER(team.name) LIKE LOWER(:q) OR LOWER(team.description) LIKE LOWER(:q))',
          { q: `%${q}%` },
        );
      }
      return qb;
    };

    const total = await build().getCount();
    const items = await build()
      .orderBy('team.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    return [items, total];
  }

  countAll(): Promise<number> {
    return this.repo.count();
  }
}
