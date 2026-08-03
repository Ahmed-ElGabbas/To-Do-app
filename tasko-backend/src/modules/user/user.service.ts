import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceNotFoundError } from '../../common/errors/domain-error';
import { Role } from '../../common/constants/role.enum';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { toUserOutput, UserOutput } from './dto/user-output.dto';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async findById(id: string): Promise<UserEntity> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new ResourceNotFoundError('User not found');
    }
    return user;
  }

  async getProfile(id: string): Promise<UserOutput> {
    const user = await this.findById(id);
    return toUserOutput(user);
  }

  async updateProfile(
    id: string,
    input: UpdateProfileDto,
  ): Promise<UserOutput> {
    const user = await this.findById(id);
    if (input.firstName !== undefined) {
      user.firstName = input.firstName;
    }
    if (input.lastName !== undefined) {
      user.lastName = input.lastName;
    }
    const saved = await this.userRepository.save(user);
    return toUserOutput(saved);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByEmailWithHash(email: string): Promise<UserEntity | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findByIdWithHash(id: string): Promise<UserEntity | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();
  }

  async create(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    role?: Role;
  }): Promise<UserEntity> {
    const user = this.userRepository.create(input);
    return this.userRepository.save(user);
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.userRepository.update(id, { passwordHash });
  }

  async updateEmail(id: string, email: string): Promise<void> {
    await this.userRepository.update(id, {
      email,
      isEmailVerified: false,
      emailVerifiedAt: null,
    });
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.userRepository.update(id, {
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    });
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.userRepository.update(id, { lastLoginAt: new Date() });
  }

  /** Attaches or clears the avatar file reference. `fileId` must exist. */
  async setAvatar(id: string, fileId: string | null): Promise<void> {
    await this.userRepository.update(id, { avatarFileId: fileId });
  }

  /** Admin: paginated user list, optionally filtered by email/name. */
  async listForAdmin(
    q: string | undefined,
    page: number,
    limit: number,
  ): Promise<[UserEntity[], number]> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC');
    if (q) {
      query.where(
        '(LOWER(user.email) LIKE LOWER(:q) OR LOWER(user.firstName) LIKE LOWER(:q) OR LOWER(user.lastName) LIKE LOWER(:q))',
        { q: `%${q}%` },
      );
    }
    const total = await query.getCount();
    const items = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    return [items, total];
  }

  /** Admin: promotes or demotes a user. Throws if the user does not exist. */
  async updateRole(id: string, role: Role): Promise<UserEntity> {
    const user = await this.findById(id);
    user.role = role;
    return this.userRepository.save(user);
  }

  async countAll(): Promise<number> {
    return this.userRepository.count();
  }
}
