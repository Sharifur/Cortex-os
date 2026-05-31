export type OutputType = 'long_form' | 'short_reply' | 'decision' | 'structured';

export interface SelfImprovementProfile {
  agentKey: string;
  outputType: OutputType;
  trackCorrections: boolean;
  patternThreshold: number;
  proposalCooldownDays: number;
}

const PROFILES: Record<string, SelfImprovementProfile> = {
  livechat:         { agentKey: 'livechat',         outputType: 'short_reply', trackCorrections: true,  patternThreshold: 3, proposalCooldownDays: 7  },
  support:          { agentKey: 'support',          outputType: 'long_form',   trackCorrections: true,  patternThreshold: 3, proposalCooldownDays: 14 },
  whatsapp:         { agentKey: 'whatsapp',         outputType: 'short_reply', trackCorrections: true,  patternThreshold: 3, proposalCooldownDays: 7  },
  email_manager:    { agentKey: 'email_manager',    outputType: 'long_form',   trackCorrections: true,  patternThreshold: 4, proposalCooldownDays: 14 },
  linkedin:         { agentKey: 'linkedin',         outputType: 'long_form',   trackCorrections: true,  patternThreshold: 4, proposalCooldownDays: 14 },
  reddit:           { agentKey: 'reddit',           outputType: 'long_form',   trackCorrections: true,  patternThreshold: 4, proposalCooldownDays: 14 },
  social:           { agentKey: 'social',           outputType: 'long_form',   trackCorrections: true,  patternThreshold: 4, proposalCooldownDays: 14 },
  shorts:           { agentKey: 'shorts',           outputType: 'structured',  trackCorrections: true,  patternThreshold: 4, proposalCooldownDays: 14 },
  taskip_trial:     { agentKey: 'taskip_trial',     outputType: 'long_form',   trackCorrections: true,  patternThreshold: 3, proposalCooldownDays: 7  },
  taskip_internal:  { agentKey: 'taskip_internal',  outputType: 'long_form',   trackCorrections: true,  patternThreshold: 3, proposalCooldownDays: 7  },
  daily_reminder:   { agentKey: 'daily_reminder',   outputType: 'short_reply', trackCorrections: false, patternThreshold: 5, proposalCooldownDays: 30 },
};

const DEFAULT: Omit<SelfImprovementProfile, 'agentKey'> = {
  outputType: 'long_form',
  trackCorrections: true,
  patternThreshold: 3,
  proposalCooldownDays: 14,
};

export function getAgentProfile(agentKey: string): SelfImprovementProfile {
  return PROFILES[agentKey] ?? { agentKey, ...DEFAULT };
}
