import { Module } from '@nestjs/common';
import { MemberModule } from '../member/member.module';
import { TaskModule } from '../task/task.module';
import { TeamModule } from '../team/team.module';
import { UserModule } from '../user/user.module';
import { AdminController } from './controllers/admin.controller';
import { AdminService } from './services/admin.service';

@Module({
  imports: [UserModule, TeamModule, MemberModule, TaskModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
