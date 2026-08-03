import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamRole } from '../../../common/constants/team-role.enum';
import { TeamMemberEntity } from '../entities/team-member.entity';
import { MemberRepository } from '../interfaces/member-repository';

@Injectable()
export class TypeOrmMemberRepository extends MemberRepository {
  constructor(
    @InjectRepository(TeamMemberEntity)
    private readonly repo: Repository<TeamMemberEntity>,
  ) {
    super();
  }

  findById(id: string): Promise<TeamMemberEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByTeamAndUser(
    teamId: string,
    userId: string,
  ): Promise<TeamMemberEntity | null> {
    return this.repo.findOne({ where: { teamId, userId } });
  }

  listByTeam(teamId: string): Promise<TeamMemberEntity[]> {
    return this.repo.find({
      where: { teamId },
      order: { createdAt: 'ASC' },
    });
  }

  create(data: {
    teamId: string;
    userId: string;
    role: TeamRole;
  }): Promise<TeamMemberEntity> {
    return this.repo.save(this.repo.create(data));
  }

  save(entity: TeamMemberEntity): Promise<TeamMemberEntity> {
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async listByTeamDetailed(teamId: string): Promise<
    Array<{
      member: TeamMemberEntity;
      user: { id: string; email: string; firstName: string; lastName: string };
    }>
  > {
    const { entities, raw } = await this.repo
      .createQueryBuilder('member')
      .leftJoin('users', 'usr', 'usr.id = member.userId')
      .addSelect(['usr.id', 'usr.email', 'usr.firstName', 'usr.lastName'])
      .where('member.teamId = :teamId', { teamId })
      .orderBy('member.createdAt', 'ASC')
      .getRawAndEntities();

    return entities.map((member, index) => ({
      member,
      user: {
        id: String(raw[index]?.usr_id ?? member.userId),
        email: String(raw[index]?.usr_email ?? ''),
        firstName: String(raw[index]?.usr_first_name ?? ''),
        lastName: String(raw[index]?.usr_last_name ?? ''),
      },
    }));
  }

  async countByTeamIds(
    teamIds: string[],
  ): Promise<Array<{ teamId: string; count: number }>> {
    if (teamIds.length === 0) {
      return [];
    }
    const rows = await this.repo
      .createQueryBuilder('member')
      .select('member.teamId', 'teamId')
      .addSelect('COUNT(*)', 'count')
      .where('member.teamId IN (:...teamIds)', { teamIds })
      .groupBy('member.teamId')
      .getRawMany();
    return rows.map((row) => ({
      teamId: String(row.teamId),
      count: Number(row.count),
    }));
  }
}
