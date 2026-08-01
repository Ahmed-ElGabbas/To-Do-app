import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from '../../common/logger/logger.module';
import { TeamModule } from '../team/team.module';
import { UserModule } from '../user/user.module';
import { MemberController } from './controllers/member.controller';
import { TeamMemberEntity } from './entities/team-member.entity';
import { MemberRepository } from './interfaces/member-repository';
import { TypeOrmMemberRepository } from './repositories/typeorm-member.repository';
import { MemberService } from './services/member.service';

@Module({
  imports: [
    LoggerModule,
    TypeOrmModule.forFeature([TeamMemberEntity]),
    TeamModule,
    UserModule,
  ],
  controllers: [MemberController],
  providers: [
    MemberService,
    { provide: MemberRepository, useClass: TypeOrmMemberRepository },
  ],
  exports: [MemberRepository],
})
export class MemberModule {}
