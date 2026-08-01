import { TeamRole } from '../../../common/constants/team-role.enum';

/** Response shape for a team membership, enriched with the user summary. */
export interface MemberOutput {
  userId: string;
  role: TeamRole;
  joinedAt: Date;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}
