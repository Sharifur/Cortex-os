import { IsEnum, IsOptional } from 'class-validator';

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
}
