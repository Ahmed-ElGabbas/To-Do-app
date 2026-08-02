import { Injectable } from '@nestjs/common';
import {
  ConflictError,
  ResourceNotFoundError,
} from '../../../common/errors/domain-error';
import { TagEntity } from '../entities/tag.entity';
import { TagRepository } from '../interfaces/tag-repository';
import { CreateTagDto } from '../dto/create-tag.dto';
import { UpdateTagDto } from '../dto/update-tag.dto';
import { TagOutput } from '../dto/tag.output';

/**
 * Tag write/read orchestration. Personal tags are owned by a single user; team
 * tags belong to the team and are managed by any `editor+` (the caller's role
 * is the TeamMembershipGuard's job). The two scopes are strictly separated so
 * a personal route can never reach a team tag and vice versa.
 */
@Injectable()
export class TagService {
  constructor(private readonly tags: TagRepository) {}

  async create(userId: string, dto: CreateTagDto): Promise<TagOutput> {
    const name = dto.name.trim();
    if (await this.tags.findByNameForUser(userId, name)) {
      throw new ConflictError('A tag with this name already exists');
    }
    const tag = await this.tags.create({ userId, teamId: null, name });
    return this.toOutput(tag);
  }

  async list(userId: string): Promise<TagOutput[]> {
    const tags = await this.tags.listByUser(userId);
    return tags.map((tag) => this.toOutput(tag));
  }

  async get(userId: string, id: string): Promise<TagOutput> {
    const tag = await this.getOwned(userId, id);
    return this.toOutput(tag);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTagDto,
  ): Promise<TagOutput> {
    const tag = await this.getOwned(userId, id);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const duplicate = await this.tags.findByNameForUser(userId, name);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError('A tag with this name already exists');
      }
      tag.name = name;
    }
    const saved = await this.tags.save(tag);
    return this.toOutput(saved);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwned(userId, id);
    await this.tags.remove(id);
  }

  async createInTeam(
    teamId: string,
    userId: string,
    dto: CreateTagDto,
  ): Promise<TagOutput> {
    const name = dto.name.trim();
    if (await this.tags.findByNameForTeam(teamId, name)) {
      throw new ConflictError('A tag with this name already exists');
    }
    const tag = await this.tags.create({ userId, teamId, name });
    return this.toOutput(tag);
  }

  async listForTeam(teamId: string): Promise<TagOutput[]> {
    const tags = await this.tags.listByTeam(teamId);
    return tags.map((tag) => this.toOutput(tag));
  }

  async getInTeam(teamId: string, id: string): Promise<TagOutput> {
    const tag = await this.getTeamTag(teamId, id);
    return this.toOutput(tag);
  }

  async updateInTeam(
    teamId: string,
    id: string,
    dto: UpdateTagDto,
  ): Promise<TagOutput> {
    const tag = await this.getTeamTag(teamId, id);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const duplicate = await this.tags.findByNameForTeam(teamId, name);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError('A tag with this name already exists');
      }
      tag.name = name;
    }
    const saved = await this.tags.save(tag);
    return this.toOutput(saved);
  }

  async removeFromTeam(teamId: string, id: string): Promise<void> {
    await this.getTeamTag(teamId, id);
    await this.tags.remove(id);
  }

  /** Loads a tag and rejects missing, other-user, or team-scoped tags identically. */
  private async getOwned(userId: string, id: string): Promise<TagEntity> {
    const tag = await this.tags.findById(id);
    if (!tag || tag.userId !== userId || tag.teamId !== null) {
      throw new ResourceNotFoundError('Tag not found');
    }
    return tag;
  }

  private async getTeamTag(teamId: string, id: string): Promise<TagEntity> {
    const tag = await this.tags.findById(id);
    if (!tag || tag.teamId !== teamId) {
      throw new ResourceNotFoundError('Tag not found');
    }
    return tag;
  }

  private toOutput(tag: TagEntity): TagOutput {
    return {
      id: tag.id,
      name: tag.name,
      teamId: tag.teamId,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    };
  }
}
