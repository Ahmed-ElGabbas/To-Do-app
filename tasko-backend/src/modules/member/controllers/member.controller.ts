import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { TeamRole } from '../../../common/constants/team-role.enum';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireTeamRole } from '../../../common/decorators/require-team-role.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';
import { AddMemberDto } from '../dto/add-member.dto';
import { ChangeMemberRoleDto } from '../dto/change-member-role.dto';
import { MemberService } from '../services/member.service';

@ApiTags('team-members')
@Controller('teams/:teamId/members')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @ApiOperation({ summary: 'List team members' })
  @Get()
  @RequireTeamRole()
  list(@Param('teamId', ParseUUIDPipe) teamId: string) {
    return this.memberService.list(teamId);
  }

  @ApiOperation({ summary: 'Add a team member (owner only)' })
  @Post()
  @RequireTeamRole(TeamRole.OWNER)
  add(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.memberService.addMember(teamId, dto);
  }

  @ApiOperation({ summary: 'Change a member role (owner only)' })
  @Patch(':userId')
  @RequireTeamRole(TeamRole.OWNER)
  changeRole(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ChangeMemberRoleDto,
  ) {
    return this.memberService.changeRole(teamId, userId, dto);
  }

  @ApiOperation({ summary: 'Remove a team member (owner only)' })
  @Delete(':userId')
  @RequireTeamRole(TeamRole.OWNER)
  remove(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.memberService.removeMember(teamId, userId);
  }
}
