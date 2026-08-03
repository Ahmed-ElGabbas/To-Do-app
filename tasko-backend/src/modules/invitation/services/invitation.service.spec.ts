import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TeamRole } from '../../../common/constants/team-role.enum';
import { TaskEventType } from '../../../infrastructure/events/task-event';
import { TaskEventBus } from '../../../infrastructure/events/task-event-bus.service';
import { MailerService } from '../../../infrastructure/mailer/mailer.service';
import { MemberRepository } from '../../member/interfaces/member-repository';
import { TeamRepository } from '../../team/interfaces/team-repository';
import { UserService } from '../../user/user.service';
import { InvitationStatus } from '../constants/invitation-status.enum';
import { InvitationRepository } from '../interfaces/invitation-repository';
import { InvitationService } from './invitation.service';

const TEAM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const INVITER = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const INVITATION_ID = '33333333-3333-4333-8333-333333333333';
const TOKEN = 's3cretInvitationToken';
const TOKEN_HASH = createHash('sha256').update(TOKEN).digest('hex');
const EMAIL = 'invitee@example.com';

describe('InvitationService', () => {
  const invitations = {
    findById: jest.fn(),
    findByTokenHash: jest.fn(),
    findPendingByTeamAndEmail: jest.fn(),
    listByTeam: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const teams = { findById: jest.fn() };
  const members = {
    findByTeamAndUser: jest.fn(),
    create: jest.fn(),
  };
  const users = {
    findByEmail: jest.fn(),
    create: jest.fn(),
  };
  const mailer = { sendMail: jest.fn(), probe: jest.fn() };
  const config = { get: jest.fn() };
  const eventBus = { publish: jest.fn(), register: jest.fn() };

  let service: InvitationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string, fallback?: string) =>
      key === 'app.baseUrl' ? 'https://tasko.example' : fallback,
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        InvitationService,
        { provide: InvitationRepository, useValue: invitations },
        { provide: TeamRepository, useValue: teams },
        { provide: MemberRepository, useValue: members },
        { provide: UserService, useValue: users },
        { provide: MailerService, useValue: mailer },
        { provide: ConfigService, useValue: config },
        { provide: TaskEventBus, useValue: eventBus },
      ],
    }).compile();
    service = moduleRef.get(InvitationService);
  });

  const team = { id: TEAM_ID, name: 'Builders', ownerId: INVITER };
  const pendingInvitation = {
    id: INVITATION_ID,
    teamId: TEAM_ID,
    email: EMAIL,
    tokenHash: TOKEN_HASH,
    role: TeamRole.VIEWER,
    status: InvitationStatus.PENDING,
    invitedBy: INVITER,
    expiresAt: new Date(Date.now() + 86_400_000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const user = {
    id: USER_ID,
    email: EMAIL,
    firstName: 'Jane',
    lastName: 'Doe',
  };

  describe('create', () => {
    it('creates an invitation and mails the accept link', async () => {
      teams.findById.mockResolvedValue(team);
      invitations.findPendingByTeamAndEmail.mockResolvedValue(null);
      users.findByEmail.mockResolvedValue(null);
      invitations.create.mockResolvedValue({ ...pendingInvitation });

      const result = await service.create(TEAM_ID, INVITER, {
        email: 'Invitee@Example.com',
        role: TeamRole.EDITOR,
      });

      expect(invitations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId: TEAM_ID,
          email: EMAIL,
          role: TeamRole.EDITOR,
          invitedBy: INVITER,
          tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        }),
      );
      expect(mailer.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: EMAIL,
          subject: "You've been invited to join Builders on Tasko",
        }),
      );
      expect(result.email).toBe(EMAIL);
    });

    it('rejects a duplicate pending invitation', async () => {
      teams.findById.mockResolvedValue(team);
      invitations.findPendingByTeamAndEmail.mockResolvedValue({
        ...pendingInvitation,
      });
      await expect(
        service.create(TEAM_ID, INVITER, { email: EMAIL }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(invitations.create).not.toHaveBeenCalled();
    });

    it('rejects an email that already belongs to a member', async () => {
      teams.findById.mockResolvedValue(team);
      invitations.findPendingByTeamAndEmail.mockResolvedValue(null);
      users.findByEmail.mockResolvedValue(user);
      members.findByTeamAndUser.mockResolvedValue({
        id: 'm1',
        teamId: TEAM_ID,
      });
      await expect(
        service.create(TEAM_ID, INVITER, { email: EMAIL }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(invitations.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown team', async () => {
      teams.findById.mockResolvedValue(null);
      await expect(
        service.create(TEAM_ID, INVITER, { email: EMAIL }),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });
  });

  describe('getByToken', () => {
    it('returns the invitation for a valid token', async () => {
      invitations.findByTokenHash.mockResolvedValue({ ...pendingInvitation });
      teams.findById.mockResolvedValue(team);
      const result = await service.getByToken(TOKEN);
      expect(invitations.findByTokenHash).toHaveBeenCalledWith(TOKEN_HASH);
      expect(result).toMatchObject({ id: INVITATION_ID, teamName: 'Builders' });
    });

    it('rejects an unknown token', async () => {
      invitations.findByTokenHash.mockResolvedValue(null);
      await expect(service.getByToken(TOKEN)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
    });

    it('rejects a resolved invitation', async () => {
      invitations.findByTokenHash.mockResolvedValue({
        ...pendingInvitation,
        status: InvitationStatus.ACCEPTED,
      });
      await expect(service.getByToken(TOKEN)).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('rejects an expired invitation', async () => {
      invitations.findByTokenHash.mockResolvedValue({
        ...pendingInvitation,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.getByToken(TOKEN)).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });
  });

  describe('accept', () => {
    it('links an existing account and creates the membership', async () => {
      invitations.findByTokenHash.mockResolvedValue({ ...pendingInvitation });
      teams.findById.mockResolvedValue(team);
      users.findByEmail.mockResolvedValue(user);
      members.findByTeamAndUser.mockResolvedValue(null);
      invitations.save.mockResolvedValue({
        ...pendingInvitation,
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
        invitedUserId: USER_ID,
      });

      const result = await service.accept(TOKEN, {});

      expect(members.create).toHaveBeenCalledWith({
        teamId: TEAM_ID,
        userId: USER_ID,
        role: TeamRole.VIEWER,
      });
      expect(invitations.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: InvitationStatus.ACCEPTED,
          invitedUserId: USER_ID,
        }),
      );
      expect(result.status).toBe(InvitationStatus.ACCEPTED);
      expect(users.create).not.toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TaskEventType.INVITATION_ACCEPTED,
          userId: INVITER,
          data: { invitedEmail: EMAIL },
        }),
      );
    });

    it('completes a stub registration for an unregistered email', async () => {
      invitations.findByTokenHash.mockResolvedValue({ ...pendingInvitation });
      teams.findById.mockResolvedValue(team);
      users.findByEmail.mockResolvedValue(null);
      users.create.mockResolvedValue(user);
      members.findByTeamAndUser.mockResolvedValue(null);
      invitations.save.mockResolvedValue({
        ...pendingInvitation,
        status: InvitationStatus.ACCEPTED,
      });

      await service.accept(TOKEN, { firstName: 'Jane', lastName: 'Doe' });

      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: EMAIL,
          firstName: 'Jane',
          lastName: 'Doe',
          role: 'USER',
        }),
      );
      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: expect.any(String) }),
      );
    });

    it('rejects accepting when the user is already a member', async () => {
      invitations.findByTokenHash.mockResolvedValue({ ...pendingInvitation });
      users.findByEmail.mockResolvedValue(user);
      members.findByTeamAndUser.mockResolvedValue({
        id: 'm1',
        teamId: TEAM_ID,
      });
      await expect(service.accept(TOKEN, {})).rejects.toMatchObject({
        code: 'CONFLICT',
      });
      expect(members.create).not.toHaveBeenCalled();
    });
  });

  describe('decline', () => {
    it('marks a pending invitation as declined', async () => {
      invitations.findByTokenHash.mockResolvedValue({ ...pendingInvitation });
      const result = await service.decline(TOKEN);
      expect(invitations.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: InvitationStatus.DECLINED,
          declinedAt: expect.any(Date),
        }),
      );
      expect(result.message).toContain('declined');
    });
  });

  describe('revoke', () => {
    it('revokes a pending invitation', async () => {
      invitations.findById.mockResolvedValue({ ...pendingInvitation });
      const result = await service.revoke(TEAM_ID, INVITATION_ID);
      expect(invitations.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: InvitationStatus.REVOKED }),
      );
      expect(result.message).toContain('revoked');
    });

    it('rejects revoking an invitation from another team', async () => {
      invitations.findById.mockResolvedValue({
        ...pendingInvitation,
        teamId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      });
      await expect(
        service.revoke(TEAM_ID, INVITATION_ID),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });

    it('rejects revoking a resolved invitation', async () => {
      invitations.findById.mockResolvedValue({
        ...pendingInvitation,
        status: InvitationStatus.ACCEPTED,
      });
      await expect(
        service.revoke(TEAM_ID, INVITATION_ID),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });
  });
});
