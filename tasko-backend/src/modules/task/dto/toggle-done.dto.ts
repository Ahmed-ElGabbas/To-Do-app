import { IsBoolean } from 'class-validator';

/** Request body for the `PATCH /tasks/:id/done` status toggle. */
export class ToggleDoneDto {
  @IsBoolean()
  isDone: boolean;
}
