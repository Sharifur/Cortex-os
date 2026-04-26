import { IsString, MinLength } from 'class-validator';

export class FollowupDto {
  @IsString()
  @MinLength(1)
  instruction!: string;
}
