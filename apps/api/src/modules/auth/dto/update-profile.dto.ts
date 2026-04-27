import { IsEmail } from 'class-validator';

export class UpdateProfileDto {
  @IsEmail()
  email!: string;
}
