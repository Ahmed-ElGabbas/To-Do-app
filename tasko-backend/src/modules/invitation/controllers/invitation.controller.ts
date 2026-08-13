import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { TeamRole } from '../../../common/constants/team-role.enum';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { RequireTeamRole } from '../../../common/decorators/require-team-role.decorator';
import { SkipTransform } from '../../../common/decorators/skip-transform.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';
import { DomainError } from '../../../common/errors/domain-error';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { DeepLinkService } from '../../deep-link/deep-link.service';
import { LandingPageService } from '../../deep-link/landing-page.service';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { CreateInvitationDto } from '../dto/create-invitation.dto';
import { InvitationService } from '../services/invitation.service';

/**
 * Team-scoped invitation management plus public magic-link routes. The
 * `teams/:teamId` routes are guarded by TeamMembershipGuard; the token routes
 * are `@Public` because the high-entropy token itself is the credential.
 */
@ApiTags('invitations')
@Controller()
export class InvitationController {
  constructor(
    private readonly invitationService: InvitationService,
    private readonly landingPage: LandingPageService,
    private readonly deepLink: DeepLinkService,
  ) {}

  @ApiOperation({ summary: 'Create a team invitation (owner only)' })
  @Post('teams/:teamId/invitations')
  @RequireTeamRole(TeamRole.OWNER)
  create(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationService.create(teamId, user.id, dto);
  }

  @ApiOperation({ summary: 'List team invitations (owner only)' })
  @Get('teams/:teamId/invitations')
  @RequireTeamRole(TeamRole.OWNER)
  list(@Param('teamId', ParseUUIDPipe) teamId: string) {
    return this.invitationService.listByTeam(teamId);
  }

  @ApiOperation({ summary: 'Revoke a team invitation (owner only)' })
  @Delete('teams/:teamId/invitations/:id')
  @RequireTeamRole(TeamRole.OWNER)
  revoke(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invitationService.revoke(teamId, id);
  }

  @ApiOperation({
    summary: 'Resolve an invitation by token (public)',
    description:
      'Serves the {success,data} JSON envelope to API clients and a self-contained HTML landing page to browsers (Accept: text/html).',
  })
  @Get('invitations/:token')
  @Public()
  @SkipTransform()
  async get(
    @Param('token') token: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const prefersHtml = (req.headers.accept ?? '').includes('text/html');
    try {
      const invitation = await this.invitationService.getByToken(token);
      if (prefersHtml) {
        return this.landingPage.render({
          token,
          baseUrl: this.deepLink.deepLinkBaseUrl,
          teamName: invitation.teamName,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        });
      }
      return { success: true, data: invitation };
    } catch (error) {
      if (!prefersHtml) {
        throw error;
      }
      const status =
        error instanceof DomainError
          ? error.httpStatus
          : error instanceof HttpException
            ? error.getStatus()
            : 500;
      res.status(status);
      return this.landingPage.renderError(status);
    }
  }

  @ApiOperation({ summary: 'Accept an invitation by token (public)' })
  @Post('invitations/:token/accept')
  @Public()
  accept(@Param('token') token: string, @Body() dto: AcceptInvitationDto) {
    return this.invitationService.accept(token, dto);
  }

  @ApiOperation({ summary: 'Decline an invitation by token (public)' })
  @Post('invitations/:token/decline')
  @Public()
  decline(@Param('token') token: string) {
    return this.invitationService.decline(token);
  }
}
