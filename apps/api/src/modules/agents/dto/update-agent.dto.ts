import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateAgentDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  pinned?: boolean;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  config?: Record<string, unknown>;
}
