import { Injectable } from '@nestjs/common';
import {
  ConflictError,
  ResourceNotFoundError,
} from '../../../common/errors/domain-error';
import { Role } from '../../../common/constants/role.enum';
import { PaginatedResult } from '../../../common/types/paginated-result';
import { MemberRepository } from '../../member/interfaces/member-repository';
import { TaskRepository } from '../../task/interfaces/task-repository';
import { TeamRepository } from '../../team/interfaces/team-repository';
import { UserService } from '../../user/user.service';
import {
  AdminStatsOutput,
  AdminTeamDetailOutput,
  AdminTeamMemberOutput,
  AdminTeamOutput,
  AdminUserOutput,
} from '../dto/admin.output';

/**
 * Platform administration: user/team oversight for ADMIN-role accounts. Every
 * route is gated by @Roles(Role.ADMIN) in AdminController.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly users: UserService,
    private readonly teams: TeamRepository,
    private readonly members: MemberRepository,
    private readonly tasks: TaskRepository,
  ) {}

  async stats(): Promise<AdminStatsOutput> {
    const [totalUsers, totalTeams, totalTasks, completedTasks] =
      await Promise.all([
        this.users.countAll(),
        this.teams.countAll(),
        this.tasks.countAll(),
        this.tasks.countCompleted(),
      ]);
    return { totalUsers, totalTeams, totalTasks, completedTasks };
  }

  async listUsers(
    q: string | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<AdminUserOutput>> {
    const [items, total] = await this.users.listForAdmin(q, page, limit);
    return {
      items: items.map(toAdminUserOutput),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUser(id: string): Promise<AdminUserOutput> {
    return toAdminUserOutput(await this.users.findById(id));
  }

  /**
   * Promotes or demotes a user. An admin cannot demote themselves (that would
   * lock the caller out of the role that lets them manage it).
   */
  async updateRole(
    actorId: string,
    id: string,
    role: Role,
  ): Promise<AdminUserOutput> {
    if (actorId === id && role !== Role.ADMIN) {
      throw new ConflictError('Admins cannot change their own role');
    }
    return toAdminUserOutput(await this.users.updateRole(id, role));
  }

  async listTeams(
    q: string | undefined,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<AdminTeamOutput>> {
    const [items, total] = await this.teams.listAllForAdmin(q, page, limit);
    const counts = new Map(
      (await this.members.countByTeamIds(items.map((team) => team.id))).map(
        (row) => [row.teamId, row.count],
      ),
    );
    return {
      items: items.map((team) => ({
        id: team.id,
        name: team.name,
        description: team.description,
        ownerId: team.ownerId,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
        memberCount: counts.get(team.id) ?? 0,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTeam(id: string): Promise<AdminTeamDetailOutput> {
    const team = await this.teams.findById(id);
    if (!team) {
      throw new ResourceNotFoundError('Team not found');
    }
    const members: AdminTeamMemberOutput[] = (
      await this.members.listByTeamDetailed(id)
    ).map(({ member, user }) => ({
      memberId: member.id,
      userId: member.userId,
      role: member.role,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    }));
    return {
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        ownerId: team.ownerId,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      },
      members,
    };
  }
}

function toAdminUserOutput(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AdminUserOutput {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
