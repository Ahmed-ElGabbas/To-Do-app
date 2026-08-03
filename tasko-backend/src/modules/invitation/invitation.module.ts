import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerModule } from '../../infrastructure/mailer/mailer.module';
import { MemberModule } from '../member/member.module';
import { TeamModule } from '../team/team.module';
import { UserModule } from '../user/user.module';
import { InvitationController } from './controllers/invitation.controller';
import { InvitationEntity } from './entities/invitation.entity';
import { InvitationRepository } from './interfaces/invitation-repository';
import { TypeOrmInvitationRepository } from './repositories/typeorm-invitation.repository';
import { InvitationService } from './services/invitation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([InvitationEntity]),
    TeamModule,
    MemberModule,
    UserModule,
    MailerModule,
  ],
  controllers: [InvitationController],
  providers: [
    InvitationService,
    { provide: InvitationRepository, useClass: TypeOrmInvitationRepository },
  ],
  exports: [InvitationRepository],
})
export class InvitationModule {}
