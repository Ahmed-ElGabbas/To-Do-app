import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import {
  ConflictError,
  ResourceNotFoundError,
} from '../../../common/errors/domain-error';
import { TeamRole } from '../../../common/constants/team-role.enum';
import { Role } from '../../../common/constants/role.enum';
import { TaskEventType } from '../../../infrastructure/events/task-event';
import { TaskEventBus } from '../../../infrastructure/events/task-event-bus.service';
import { MailerService } from '../../../infrastructure/mailer/mailer.service';
import { MemberRepository } from '../../member/interfaces/member-repository';
import { TeamRepository } from '../../team/interfaces/team-repository';
import { UserService } from '../../user/user.service';
import { InvitationStatus } from '../constants/invitation-status.enum';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { CreateInvitationDto } from '../dto/create-invitation.dto';
import { InvitationOutput, toInvitationOutput } from '../dto/invitation.output';
import { InvitationEntity } from '../entities/invitation.entity';
import { InvitationRepository } from '../interfaces/invitation-repository';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Creates and resolves team invitations. A PENDING invitation carries a
 * high-entropy token (stored only as a SHA-256 hash) that grants whoever holds
 * it the ability to accept — the magic-link model. Accepting either links an
 * existing account or completes a stub registration for an unregistered
 * address, then creates the team membership.
 */
@Injectable()
export class InvitationService {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly teams: TeamRepository,
    private readonly members: MemberRepository,
    private readonly users: UserService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
    private readonly eventBus: TaskEventBus,
  ) {}

  async create(
    teamId: string,
    invitedBy: string,
    dto: CreateInvitationDto,
  ): Promise<InvitationOutput> {
    const email = dto.email.toLowerCase();
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw new ResourceNotFoundError('Team not found');
    }

    const existing = await this.invitations.findPendingByTeamAndEmail(
      teamId,
      email,
    );
    if (existing) {
      throw new ConflictError(
        'An invitation is already pending for this email',
      );
    }

    const user = await this.users.findByEmail(email);
    if (user) {
      const membership = await this.members.findByTeamAndUser(teamId, user.id);
      if (membership) {
        throw new ConflictError('This email already belongs to a team member');
      }
    }

    const rawToken = randomBytes(32).toString('base64url');
    const invitation = await this.invitations.create({
      teamId,
      email,
      tokenHash: this.hashToken(rawToken),
      role: dto.role ?? TeamRole.VIEWER,
      invitedBy,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    });

    await this.mailer.sendMail({
      to: email,
      subject: `You've been invited to join ${team.name} on Tasko`,
      html: this.invitationHtml(team.name, rawToken),
    });

    return toInvitationOutput(invitation, team.name);
  }

  async listByTeam(teamId: string): Promise<InvitationOutput[]> {
    const rows = await this.invitations.listByTeam(teamId);
    return Promise.all(
      rows.map(async (row) => {
        const team = await this.teams.findById(row.teamId);
        return toInvitationOutput(row, team?.name ?? '');
      }),
    );
  }

  async getByToken(token: string): Promise<InvitationOutput> {
    const invitation = await this.getValidPending(token);
    const team = await this.teams.findById(invitation.teamId);
    return toInvitationOutput(invitation, team?.name ?? '');
  }

  async accept(
    token: string,
    dto: AcceptInvitationDto,
  ): Promise<InvitationOutput> {
    const invitation = await this.getValidPending(token);

    let user = await this.users.findByEmail(invitation.email);
    if (!user) {
      user = await this.users.create({
        email: invitation.email,
        passwordHash: await this.unusablePasswordHash(),
        firstName: dto.firstName?.trim() || 'Invited',
        lastName: dto.lastName?.trim() || 'User',
        role: Role.USER,
      });
    }

    const membership = await this.members.findByTeamAndUser(
      invitation.teamId,
      user.id,
    );
    if (membership) {
      throw new ConflictError('This user is already a member of the team');
    }
    await this.members.create({
      teamId: invitation.teamId,
      userId: user.id,
      role: invitation.role,
    });

    invitation.status = InvitationStatus.ACCEPTED;
    invitation.acceptedAt = new Date();
    invitation.invitedUserId = user.id;
    const saved = await this.invitations.save(invitation);

    await this.eventBus.publish({
      id: randomUUID(),
      type: TaskEventType.INVITATION_ACCEPTED,
      userId: invitation.invitedBy,
      occurredAt: new Date().toISOString(),
      data: { invitedEmail: invitation.email },
    });

    const team = await this.teams.findById(invitation.teamId);
    return toInvitationOutput(saved, team?.name ?? '');
  }

  async decline(token: string): Promise<{ message: string }> {
    const invitation = await this.getValidPending(token);
    invitation.status = InvitationStatus.DECLINED;
    invitation.declinedAt = new Date();
    await this.invitations.save(invitation);
    return { message: 'Invitation declined' };
  }

  async revoke(teamId: string, id: string): Promise<{ message: string }> {
    const found = await this.invitations.findById(id);
    if (!found || found.teamId !== teamId) {
      throw new ResourceNotFoundError('Invitation not found');
    }
    if (found.status !== InvitationStatus.PENDING) {
      throw new ConflictError('Invitation is no longer pending');
    }
    found.status = InvitationStatus.REVOKED;
    await this.invitations.save(found);
    return { message: 'Invitation revoked' };
  }

  /** Loads a PENDING, unexpired invitation or throws. */
  private async getValidPending(token: string): Promise<InvitationEntity> {
    const invitation = await this.invitations.findByTokenHash(
      this.hashToken(token),
    );
    if (!invitation) {
      throw new ResourceNotFoundError('Invitation not found');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new ConflictError('Invitation has already been resolved');
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new ConflictError('Invitation has expired');
    }
    return invitation;
  }

  /** A random unusable hash so stub accounts can never sign in. */
  private async unusablePasswordHash(): Promise<string> {
    return argon2.hash(randomBytes(24).toString('base64url'));
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private invitationHtml(teamName: string, rawToken: string): string {
    const link = `${this.config.get<string>('app.baseUrl')}/invitations/${encodeURIComponent(rawToken)}`;
    return `<p>You've been invited to join <strong>${teamName}</strong> on Tasko.</p><a href="${link}">Accept invitation</a>`;
  }
}
