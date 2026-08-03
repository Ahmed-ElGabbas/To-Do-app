import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body of a new task comment. */
export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body: string;
}
