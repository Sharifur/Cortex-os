import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export enum ManualTriggerType {
  MANUAL = 'MANUAL',
  API = 'API',
}

export class TriggerAgentDto {
  @IsEnum(ManualTriggerType)
  @IsOptional()
  triggerType?: ManualTriggerType = ManualTriggerType.MANUAL;

  @IsOptional()
  payload?: unknown;

  @IsNumber()
  @Min(0)
  @IsOptional()
  delayMs?: number;
}
