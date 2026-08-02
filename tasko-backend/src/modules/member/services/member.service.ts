import { Injectable } from '@nestjs/common';
import {
  ConflictError,
  ForbiddenActionError,
  ResourceNotFoundError,
} from '../../../common/errors/domain-error';
import { TeamRole } from '../../../common/constants/team-role.enum';
import { TeamRepository } from '../../team/interfaces/team-repository';
import { UserService } from '../../user/user.service';
import { TeamMemberEntity } from '../entities/team-member.entity';
import { MemberRepository } from '../interfaces/member-repository';
import { AddMemberDto } from '../dto/add-member.dto';
import { ChangeMemberRoleDto } from '../dto/change-member-role.dto';
import { MemberOutput } from '../dto/member.output';

@Injectable()
export class MemberService {
  constructor(
    private readonly members: MemberRepository,
    private readonly teams: TeamRepository,
    private readonly users: UserService,
  ) {}

  async list(teamId: string): Promise<MemberOutput[]> {
    const rows = await this.members.listByTeam(teamId);
    const users = await Promise.all(
      rows.map((row) => this.users.findById(row.userId)),
    );
    return rows.map((row, index) => this.toOutput(row, users[index]));
  }

  async addMember(teamId: string, dto: AddMemberDto): Promise<MemberOutput> {
    const user = await this.users.findByEmail(dto.email.toLowerCase());
    if (!user) {
      throw new ResourceNotFoundError('User not found');
    }
    const existing = await this.members.findByTeamAndUser(teamId, user.id);
    if (existing) {
      throw new ConflictError('This user is already a member of this team');
    }
    const member = await this.members.create({
      teamId,
      userId: user.id,
      role: dto.role ?? TeamRole.VIEWER,
    });
    return this.toOutput(member, user);
  }

  async changeRole(
    teamId: string,
    userId: string,
    dto: ChangeMemberRoleDto,
  ): Promise<MemberOutput> {
    const member = await this.getMembership(teamId, userId);
    const team = await this.teams.findById(teamId);
    if (team && member.userId === team.ownerId && dto.role !== TeamRole.OWNER) {
      throw new ForbiddenActionError('The team owner cannot be demoted');
    }
    member.role = dto.role;
    const saved = await this.members.save(member);
    return this.toOutput(saved, await this.users.findById(userId));
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    const member = await this.getMembership(teamId, userId);
    const team = await this.teams.findById(teamId);
    if (team && member.userId === team.ownerId) {
      throw new ForbiddenActionError('The team owner cannot be removed');
    }
    await this.members.remove(member.id);
  }

  private async getMembership(
    teamId: string,
    userId: string,
  ): Promise<TeamMemberEntity> {
    const member = await this.members.findByTeamAndUser(teamId, userId);
    if (!member) {
      throw new ResourceNotFoundError('Membership not found');
    }
    return member;
  }

  private toOutput(
    member: TeamMemberEntity,
    user: { id: string; email: string; firstName: string; lastName: string },
  ): MemberOutput {
    return {
      userId: member.userId,
      role: member.role,
      joinedAt: member.createdAt,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }
}
