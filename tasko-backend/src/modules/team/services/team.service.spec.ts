import { Test } from '@nestjs/testing';
import { TeamRole } from '../../../common/constants/team-role.enum';
import { TeamRepository } from '../interfaces/team-repository';
import { TeamService } from './team.service';

const OWNER = '11111111-1111-4111-8111-111111111111';
const TEAM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('TeamService', () => {
  const repo = {
    findById: jest.fn(),
    listForMember: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  let service: TeamService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [TeamService, { provide: TeamRepository, useValue: repo }],
    }).compile();
    service = moduleRef.get(TeamService);
  });

  const team = {
    id: TEAM_ID,
    name: 'Weekend Trip',
    description: 'Plan the trip',
    ownerId: OWNER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('trims name/description and creates the team with the caller as owner', async () => {
      repo.create.mockResolvedValue(team);
      const result = await service.create(OWNER, {
        name: '  Weekend Trip  ',
        description: '  Plan the trip  ',
      });
      expect(repo.create).toHaveBeenCalledWith({
        name: 'Weekend Trip',
        description: 'Plan the trip',
        ownerId: OWNER,
      });
      expect(result.id).toBe(TEAM_ID);
      expect(result.ownerId).toBe(OWNER);
    });

    it('stores a null description when omitted', async () => {
      repo.create.mockResolvedValue({ ...team, description: null });
      const result = await service.create(OWNER, { name: 'Trip' });
      expect(repo.create).toHaveBeenCalledWith({
        name: 'Trip',
        description: null,
        ownerId: OWNER,
      });
      expect(result.description).toBeNull();
    });
  });

  describe('list', () => {
    it('returns teams with the caller role', async () => {
      repo.listForMember.mockResolvedValue([{ team, role: TeamRole.OWNER }]);
      const result = await service.list(OWNER);
      expect(result).toEqual([
        expect.objectContaining({ id: TEAM_ID, role: TeamRole.OWNER }),
      ]);
    });
  });

  describe('get', () => {
    it('returns the team', async () => {
      repo.findById.mockResolvedValue(team);
      const result = await service.get(TEAM_ID);
      expect(result.name).toBe('Weekend Trip');
    });

    it('rejects a missing team', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.get(TEAM_ID)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
    });
  });

  describe('update', () => {
    it('updates only provided fields', async () => {
      repo.findById.mockResolvedValue(team);
      repo.save.mockResolvedValue({ ...team, name: 'New Name' });
      const result = await service.update(TEAM_ID, { name: 'New Name' });
      expect(result.name).toBe('New Name');
      expect(result.description).toBe('Plan the trip');
    });

    it('clears the description when an empty string is sent', async () => {
      repo.findById.mockResolvedValue(team);
      repo.save.mockResolvedValue({ ...team, description: null });
      const result = await service.update(TEAM_ID, { description: '' });
      expect(result.description).toBeNull();
    });
  });

  describe('remove', () => {
    it('deletes an existing team', async () => {
      repo.findById.mockResolvedValue(team);
      await service.remove(TEAM_ID);
      expect(repo.remove).toHaveBeenCalledWith(TEAM_ID);
    });

    it('rejects deleting a missing team', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.remove(TEAM_ID)).rejects.toMatchObject({
        code: 'RESOURCE_NOT_FOUND',
      });
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });
});
