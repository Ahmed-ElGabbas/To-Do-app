import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceNotFoundError } from '../../common/errors/domain-error';
import { Role } from '../../common/constants/role.enum';
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
}
