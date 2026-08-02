import { Injectable } from '@nestjs/common';
import {
  ConflictError,
  ResourceNotFoundError,
} from '../../../common/errors/domain-error';
import { CategoryEntity } from '../entities/category.entity';
import { CategoryRepository } from '../interfaces/category-repository';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CategoryOutput } from '../dto/category.output';

/**
 * Category write/read orchestration. Personal categories are owned by a single
 * user; team categories belong to the team and are managed by any `editor+`
 * (the caller's role is the TeamMembershipGuard's job). The two scopes are
 * strictly separated so a personal route can never reach a team category and
 * vice versa.
 */
@Injectable()
export class CategoryService {
  constructor(private readonly categories: CategoryRepository) {}

  async create(
    userId: string,
    dto: CreateCategoryDto,
  ): Promise<CategoryOutput> {
    const name = dto.name.trim();
    if (await this.categories.findByNameForUser(userId, name)) {
      throw new ConflictError('A category with this name already exists');
    }
    const category = await this.categories.create({
      userId,
      teamId: null,
      name,
    });
    return this.toOutput(category);
  }

  async list(userId: string): Promise<CategoryOutput[]> {
    const categories = await this.categories.listByUser(userId);
    return categories.map((category) => this.toOutput(category));
  }

  async get(userId: string, id: string): Promise<CategoryOutput> {
    const category = await this.getOwned(userId, id);
    return this.toOutput(category);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryOutput> {
    const category = await this.getOwned(userId, id);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const duplicate = await this.categories.findByNameForUser(userId, name);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError('A category with this name already exists');
      }
      category.name = name;
    }
    const saved = await this.categories.save(category);
    return this.toOutput(saved);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwned(userId, id);
    // Tasks referencing this category are detached by the DB FK (ON DELETE SET NULL).
    await this.categories.remove(id);
  }

  async createInTeam(
    teamId: string,
    userId: string,
    dto: CreateCategoryDto,
  ): Promise<CategoryOutput> {
    const name = dto.name.trim();
    if (await this.categories.findByNameForTeam(teamId, name)) {
      throw new ConflictError('A category with this name already exists');
    }
    const category = await this.categories.create({ userId, teamId, name });
    return this.toOutput(category);
  }

  async listForTeam(teamId: string): Promise<CategoryOutput[]> {
    const categories = await this.categories.listByTeam(teamId);
    return categories.map((category) => this.toOutput(category));
  }

  async getInTeam(teamId: string, id: string): Promise<CategoryOutput> {
    const category = await this.getTeamCategory(teamId, id);
    return this.toOutput(category);
  }

  async updateInTeam(
    teamId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryOutput> {
    const category = await this.getTeamCategory(teamId, id);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const duplicate = await this.categories.findByNameForTeam(teamId, name);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError('A category with this name already exists');
      }
      category.name = name;
    }
    const saved = await this.categories.save(category);
    return this.toOutput(saved);
  }

  async removeFromTeam(teamId: string, id: string): Promise<void> {
    await this.getTeamCategory(teamId, id);
    await this.categories.remove(id);
  }

  private async getOwned(userId: string, id: string): Promise<CategoryEntity> {
    const category = await this.categories.findById(id);
    if (!category || category.userId !== userId || category.teamId !== null) {
      throw new ResourceNotFoundError('Category not found');
    }
    return category;
  }

  private async getTeamCategory(
    teamId: string,
    id: string,
  ): Promise<CategoryEntity> {
    const category = await this.categories.findById(id);
    if (!category || category.teamId !== teamId) {
      throw new ResourceNotFoundError('Category not found');
    }
    return category;
  }

  private toOutput(category: CategoryEntity): CategoryOutput {
    return {
      id: category.id,
      name: category.name,
      teamId: category.teamId,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}
