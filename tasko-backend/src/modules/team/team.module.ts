import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from '../../common/logger/logger.module';
import { TeamMemberEntity } from '../member/entities/team-member.entity';
import { TeamController } from './controllers/team.controller';
import { TeamEntity } from './entities/team.entity';
import { TeamRepository } from './interfaces/team-repository';
import { TypeOrmTeamRepository } from './repositories/typeorm-team.repository';
import { TeamService } from './services/team.service';

@Module({
  imports: [
    LoggerModule,
    TypeOrmModule.forFeature([TeamEntity, TeamMemberEntity]),
  ],
  controllers: [TeamController],
  providers: [
    TeamService,
    { provide: TeamRepository, useClass: TypeOrmTeamRepository },
  ],
  exports: [TeamRepository],
})
export class TeamModule {}
