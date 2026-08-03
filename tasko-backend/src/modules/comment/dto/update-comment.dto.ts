import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Updated body of an existing task comment. */
export class UpdateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body: string;
}
