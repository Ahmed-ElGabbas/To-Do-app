import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamRole } from '../../../common/constants/team-role.enum';
import { InvitationStatus } from '../constants/invitation-status.enum';
import { InvitationEntity } from '../entities/invitation.entity';
import { InvitationRepository } from '../interfaces/invitation-repository';

@Injectable()
export class TypeOrmInvitationRepository extends InvitationRepository {
  constructor(
    @InjectRepository(InvitationEntity)
    private readonly repo: Repository<InvitationEntity>,
  ) {
    super();
  }

  findById(id: string): Promise<InvitationEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByTokenHash(tokenHash: string): Promise<InvitationEntity | null> {
    return this.repo.findOne({ where: { tokenHash } });
  }

  findPendingByTeamAndEmail(
    teamId: string,
    email: string,
  ): Promise<InvitationEntity | null> {
    return this.repo.findOne({
      where: { teamId, email, status: InvitationStatus.PENDING },
    });
  }

  listByTeam(teamId: string): Promise<InvitationEntity[]> {
    return this.repo.find({
      where: { teamId },
      order: { createdAt: 'DESC' },
    });
  }

  create(data: {
    teamId: string;
    email: string;
    tokenHash: string;
    role: TeamRole;
    invitedBy: string;
    expiresAt: Date;
  }): Promise<InvitationEntity> {
    return this.repo.save(this.repo.create(data));
  }

  save(entity: InvitationEntity): Promise<InvitationEntity> {
    return this.repo.save(entity);
  }
}
