import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TeamRole } from '../constants/team-role.enum';
import { MemberRepository } from '../../modules/member/interfaces/member-repository';
import { TeamMembershipGuard } from './team-membership.guard';

const TEAM_ID = '99999999-9999-4999-8999-999999999999';
const USER_ID = '11111111-1111-4111-8111-111111111111';

function makeRequest(overrides: Record<string, unknown> = {}) {
  return { params: { teamId: TEAM_ID }, ...overrides };
}

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => jest.fn(),
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('TeamMembershipGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const members = { findByTeamAndUser: jest.fn() };
  let guard: TeamMembershipGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new TeamMembershipGuard(
      reflector as unknown as Reflector,
      members as unknown as MemberRepository,
    );
  });

  it('skips routes without @RequireTeamRole', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const request = makeRequest({ user: undefined });
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(members.findByTeamAndUser).not.toHaveBeenCalled();
  });

  it('rejects a missing authenticated user', async () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    await expect(
      guard.canActivate(makeContext(makeRequest({ user: undefined }))),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects a route without a teamId path parameter', async () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const request = makeRequest({ user: { id: USER_ID }, params: {} });
    await expect(guard.canActivate(makeContext(request))).rejects.toMatchObject(
      { code: 'FORBIDDEN' },
    );
  });

  it('rejects a caller who is not a team member', async () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    members.findByTeamAndUser.mockResolvedValue(null);
    const request = makeRequest({ user: { id: USER_ID } });
    await expect(guard.canActivate(makeContext(request))).rejects.toMatchObject(
      { code: 'FORBIDDEN' },
    );
  });

  it('allows any member when no role requirement is set', async () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    members.findByTeamAndUser.mockResolvedValue({ role: TeamRole.VIEWER });
    const request = makeRequest({ user: { id: USER_ID } });
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request.teamMembership).toEqual({
      teamId: TEAM_ID,
      userId: USER_ID,
      role: TeamRole.VIEWER,
    });
    expect(request.teamContext.teamId).toBe(TEAM_ID);
  });

  it('allows a member with exactly the required role', async () => {
    reflector.getAllAndOverride.mockReturnValue([TeamRole.EDITOR]);
    members.findByTeamAndUser.mockResolvedValue({ role: TeamRole.EDITOR });
    await expect(
      guard.canActivate(makeContext(makeRequest({ user: { id: USER_ID } }))),
    ).resolves.toBe(true);
  });

  it('allows a member with a higher role than required (hierarchy)', async () => {
    reflector.getAllAndOverride.mockReturnValue([TeamRole.EDITOR]);
    members.findByTeamAndUser.mockResolvedValue({ role: TeamRole.OWNER });
    await expect(
      guard.canActivate(makeContext(makeRequest({ user: { id: USER_ID } }))),
    ).resolves.toBe(true);
  });

  it('allows a member holding one of several required roles', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      TeamRole.OWNER,
      TeamRole.EDITOR,
    ]);
    members.findByTeamAndUser.mockResolvedValue({ role: TeamRole.EDITOR });
    await expect(
      guard.canActivate(makeContext(makeRequest({ user: { id: USER_ID } }))),
    ).resolves.toBe(true);
  });

  it('rejects a member whose role is below the requirement', async () => {
    reflector.getAllAndOverride.mockReturnValue([TeamRole.EDITOR]);
    members.findByTeamAndUser.mockResolvedValue({ role: TeamRole.VIEWER });
    await expect(
      guard.canActivate(makeContext(makeRequest({ user: { id: USER_ID } }))),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects a viewer on an owner-only route', async () => {
    reflector.getAllAndOverride.mockReturnValue([TeamRole.OWNER]);
    members.findByTeamAndUser.mockResolvedValue({ role: TeamRole.EDITOR });
    await expect(
      guard.canActivate(makeContext(makeRequest({ user: { id: USER_ID } }))),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
