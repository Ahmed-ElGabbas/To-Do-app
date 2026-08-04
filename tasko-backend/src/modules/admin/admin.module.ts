import { Module } from '@nestjs/common';
import { TaskEventsModule } from '../../infrastructure/events/task-events.module';
import { MemberModule } from '../member/member.module';
import { TaskModule } from '../task/task.module';
import { TeamModule } from '../team/team.module';
import { UserModule } from '../user/user.module';
import { AdminController } from './controllers/admin.controller';
import { AdminService } from './services/admin.service';

@Module({
  imports: [UserModule, TeamModule, MemberModule, TaskModule, TaskEventsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
