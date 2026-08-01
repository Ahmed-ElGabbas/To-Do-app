import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserDeviceEntity } from '../entities/user-device.entity';
import {
  CreateDeviceData,
  DeviceTokenRepository,
} from '../interfaces/device-token-repository';

@Injectable()
export class TypeOrmDeviceTokenRepository extends DeviceTokenRepository {
  constructor(
    @InjectRepository(UserDeviceEntity)
    private readonly repo: Repository<UserDeviceEntity>,
  ) {
    super();
  }

  findByToken(token: string): Promise<UserDeviceEntity | null> {
    return this.repo.findOne({ where: { token } });
  }

  findByUser(userId: string): Promise<UserDeviceEntity[]> {
    return this.repo.find({ where: { userId } });
  }

  create(data: CreateDeviceData): Promise<UserDeviceEntity> {
    return this.repo.save(this.repo.create(data));
  }

  save(entity: UserDeviceEntity): Promise<UserDeviceEntity> {
    return this.repo.save(entity);
  }

  async remove(entity: UserDeviceEntity): Promise<void> {
    await this.repo.remove(entity);
  }
}
