import { Test } from '@nestjs/testing';
import { TeamRole } from '../../../common/constants/team-role.enum';
import { TeamRepository } from '../../team/interfaces/team-repository';
import { UserService } from '../../user/user.service';
import { MemberRepository } from '../interfaces/member-repository';
import { MemberService } from './member.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const MEMBER = '22222222-2222-4222-8222-222222222222';
const TEAM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('MemberService', () => {
  const members = {
    findByTeamAndUser: jest.fn(),
    listByTeam: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const teams = { findById: jest.fn() };
  const users = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
  };

  let service: MemberService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        MemberService,
        { provide: MemberRepository, useValue: members },
        { provide: TeamRepository, useValue: teams },
        { provide: UserService, useValue: users },
      ],
    }).compile();
    service = moduleRef.get(MemberService);
  });

  const membership = {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    teamId: TEAM_ID,
    userId: MEMBER,
    role: TeamRole.VIEWER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const user = {
    id: MEMBER,
    email: 'member@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
  };

  describe('list', () => {
    it('returns members enriched with user summaries', async () => {
      members.listByTeam.mockResolvedValue([membership]);
      users.findById.mockResolvedValue(user);
      const result = await service.list(TEAM_ID);
      expect(result).toEqual([
        {
          userId: MEMBER,
          role: TeamRole.VIEWER,
          joinedAt: membership.createdAt,
          user,
        },
      ]);
      expect(users.findById).toHaveBeenCalledWith(MEMBER);
    });
  });

  describe('addMember', () => {
    it('adds a new member with the default viewer role', async () => {
      users.findByEmail.mockResolvedValue(user);
      members.findByTeamAndUser.mockResolvedValue(null);
      members.create.mockResolvedValue(membership);

      const result = await service.addMember(TEAM_ID, {
        email: 'Member@Example.com',
      });

      expect(users.findByEmail).toHaveBeenCalledWith('member@example.com');
      expect(members.create).toHaveBeenCalledWith({
        teamId: TEAM_ID,
        userId: MEMBER,
        role: TeamRole.VIEWER,
      });
      expect(result.userId).toBe(MEMBER);
    });

    it('rejects adding an unknown user', async () => {
      users.findByEmail.mockResolvedValue(null);
      await expect(
        service.addMember(TEAM_ID, { email: 'ghost@example.com' }),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
      expect(members.create).not.toHaveBeenCalled();
    });

    it('rejects adding an existing member', async () => {
      users.findByEmail.mockResolvedValue(user);
      members.findByTeamAndUser.mockResolvedValue(membership);
      await expect(
        service.addMember(TEAM_ID, { email: 'member@example.com' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(members.create).not.toHaveBeenCalled();
    });
  });

  describe('changeRole', () => {
    it('changes the role of a non-owner member', async () => {
      members.findByTeamAndUser.mockResolvedValue(membership);
      teams.findById.mockResolvedValue({ id: TEAM_ID, ownerId: OWNER });
      members.save.mockResolvedValue({ ...membership, role: TeamRole.EDITOR });
      users.findById.mockResolvedValue(user);

      const result = await service.changeRole(TEAM_ID, MEMBER, {
        role: TeamRole.EDITOR,
      });
      expect(result.role).toBe(TeamRole.EDITOR);
    });

    it('rejects demoting the team owner', async () => {
      const ownerMembership = {
        ...membership,
        userId: OWNER,
        role: TeamRole.OWNER,
      };
      members.findByTeamAndUser.mockResolvedValue(ownerMembership);
      teams.findById.mockResolvedValue({ id: TEAM_ID, ownerId: OWNER });

      await expect(
        service.changeRole(TEAM_ID, OWNER, { role: TeamRole.VIEWER }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(members.save).not.toHaveBeenCalled();
    });

    it('rejects a missing membership', async () => {
      members.findByTeamAndUser.mockResolvedValue(null);
      await expect(
        service.changeRole(TEAM_ID, MEMBER, { role: TeamRole.EDITOR }),
      ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    });
  });

  describe('removeMember', () => {
    it('removes a non-owner member', async () => {
      members.findByTeamAndUser.mockResolvedValue(membership);
      teams.findById.mockResolvedValue({ id: TEAM_ID, ownerId: OWNER });
      await service.removeMember(TEAM_ID, MEMBER);
      expect(members.remove).toHaveBeenCalledWith(membership.id);
    });

    it('rejects removing the team owner', async () => {
      const ownerMembership = {
        ...membership,
        userId: OWNER,
        role: TeamRole.OWNER,
      };
      members.findByTeamAndUser.mockResolvedValue(ownerMembership);
      teams.findById.mockResolvedValue({ id: TEAM_ID, ownerId: OWNER });
      await expect(service.removeMember(TEAM_ID, OWNER)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      expect(members.remove).not.toHaveBeenCalled();
    });
  });
});
