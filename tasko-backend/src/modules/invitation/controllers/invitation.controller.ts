import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { TeamRole } from '../../../common/constants/team-role.enum';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { RequireTeamRole } from '../../../common/decorators/require-team-role.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { CreateInvitationDto } from '../dto/create-invitation.dto';
import { InvitationService } from '../services/invitation.service';

/**
 * Team-scoped invitation management plus public magic-link routes. The
 * `teams/:teamId` routes are guarded by TeamMembershipGuard; the token routes
 * are `@Public` because the high-entropy token itself is the credential.
 */
@Controller()
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post('teams/:teamId/invitations')
  @RequireTeamRole(TeamRole.OWNER)
  create(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationService.create(teamId, user.id, dto);
  }

  @Get('teams/:teamId/invitations')
  @RequireTeamRole(TeamRole.OWNER)
  list(@Param('teamId', ParseUUIDPipe) teamId: string) {
    return this.invitationService.listByTeam(teamId);
  }

  @Delete('teams/:teamId/invitations/:id')
  @RequireTeamRole(TeamRole.OWNER)
  revoke(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invitationService.revoke(teamId, id);
  }

  @Get('invitations/:token')
  @Public()
  get(@Param('token') token: string) {
    return this.invitationService.getByToken(token);
  }

  @Post('invitations/:token/accept')
  @Public()
  accept(@Param('token') token: string, @Body() dto: AcceptInvitationDto) {
    return this.invitationService.accept(token, dto);
  }

  @Post('invitations/:token/decline')
  @Public()
  decline(@Param('token') token: string) {
    return this.invitationService.decline(token);
  }
}
