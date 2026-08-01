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
}
