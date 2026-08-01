import { Injectable } from '@nestjs/common';
import { ResourceNotFoundError } from '../../../common/errors/domain-error';
import { TeamEntity } from '../entities/team.entity';
import { TeamRepository } from '../interfaces/team-repository';
import { CreateTeamDto } from '../dto/create-team.dto';
import { UpdateTeamDto } from '../dto/update-team.dto';
import {
  TeamOutput,
  TeamWithRoleOutput,
} from '../dto/team.output';

@Injectable()
export class TeamService {
  constructor(private readonly teams: TeamRepository) {}

  async create(userId: string, dto: CreateTeamDto): Promise<TeamOutput> {
    const team = await this.teams.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      ownerId: userId,
    });
    return this.toOutput(team);
  }

  async list(userId: string): Promise<TeamWithRoleOutput[]> {
    const rows = await this.teams.listForUserWithRole(userId);
    return rows.map((row) => ({
      ...this.toOutput(row.team),
      role: row.role,
    }));
  }

  async get(teamId: string): Promise<TeamOutput> {
    return this.toOutput(await this.getTeam(teamId));
  }

  async update(
    teamId: string,
    dto: UpdateTeamDto,
  ): Promise<TeamOutput> {
    const team = await this.getTeam(teamId);
    if (dto.name !== undefined) {
      team.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      team.description = dto.description?.trim() || null;
    }
    return this.toOutput(await this.teams.save(team));
  }

  async remove(teamId: string): Promise<void> {
    await this.getTeam(teamId);
    // Members, team tasks, categories and tags are removed by DB FK cascades.
    await this.teams.remove(teamId);
  }

  private async getTeam(teamId: string): Promise<TeamEntity> {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw new ResourceNotFoundError('Team not found');
    }
    return team;
  }

  private toOutput(team: TeamEntity): TeamOutput {
    return {
      id: team.id,
      name: team.name,
      description: team.description ?? null,
      ownerId: team.ownerId,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }
}
