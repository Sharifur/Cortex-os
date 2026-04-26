export interface SettingDefinition {
  label: string;
  description?: string;
  isSecret: boolean;
  group: 'llm' | 'telegram' | 'ses' | 'gmail' | 'integrations';
  defaultValue?: string;
  provider?: 'openai' | 'gemini' | 'deepseek' | 'general';
}

export const SETTING_DEFINITIONS: Record<string, SettingDefinition> = {
  // LLM — general
  llm_default_provider: {
    label: 'Default Provider',
    description: 'Which LLM provider to use by default. "auto" tries OpenAI → Gemini → DeepSeek.',
    isSecret: false,
    group: 'llm',
    defaultValue: 'auto',
    provider: 'general',
  },

  // LLM — OpenAI
  openai_api_key: {
    label: 'OpenAI API Key',
    description: 'Used for GPT models. Starts with sk-',
    isSecret: true,
    group: 'llm',
    provider: 'openai',
  },
  openai_default_model: {
    label: 'Default Model',
    description: 'e.g. gpt-4o-mini, gpt-4o',
    isSecret: false,
    group: 'llm',
    defaultValue: 'gpt-4o-mini',
    provider: 'openai',
  },

  // LLM — Gemini
  gemini_api_key: {
    label: 'Gemini API Key',
    description: 'Google AI Studio API key',
    isSecret: true,
    group: 'llm',
    provider: 'gemini',
  },
  gemini_default_model: {
    label: 'Default Model',
    description: 'e.g. gemini-1.5-flash, gemini-1.5-pro',
    isSecret: false,
    group: 'llm',
    defaultValue: 'gemini-1.5-flash',
    provider: 'gemini',
  },

  // LLM — DeepSeek
  deepseek_api_key: {
    label: 'DeepSeek API Key',
    description: 'DeepSeek API key',
    isSecret: true,
    group: 'llm',
    provider: 'deepseek',
  },
  deepseek_default_model: {
    label: 'Default Model',
    description: 'e.g. deepseek-chat, deepseek-reasoner',
    isSecret: false,
    group: 'llm',
    defaultValue: 'deepseek-chat',
    provider: 'deepseek',
  },

  // Telegram
  telegram_bot_token: {
    label: 'Telegram Bot Token',
    description: 'From @BotFather',
    isSecret: true,
    group: 'telegram',
  },
  telegram_owner_chat_id: {
    label: 'Telegram Owner Chat ID',
    description: 'Your personal Telegram chat ID',
    isSecret: false,
    group: 'telegram',
  },

  // SES — AWS credentials
  aws_access_key_id: {
    label: 'AWS Access Key ID',
    description: 'IAM user with ses:SendEmail permission',
    isSecret: true,
    group: 'ses',
  },
  aws_secret_access_key: {
    label: 'AWS Secret Access Key',
    isSecret: true,
    group: 'ses',
  },
  aws_region: {
    label: 'AWS Region',
    description: 'SES-enabled region, e.g. ap-south-1',
    isSecret: false,
    group: 'ses',
    defaultValue: 'ap-south-1',
  },
  ses_from_address: {
    label: 'From Address',
    description: 'e.g. Sharifur <sharifur@taskip.net>',
    isSecret: false,
    group: 'ses',
  },
  ses_configuration_set: {
    label: 'Configuration Set',
    isSecret: false,
    group: 'ses',
    defaultValue: 'ses-monitoring',
  },

  // Gmail — OAuth2
  gmail_client_id: {
    label: 'OAuth2 Client ID',
    description: 'From Google Cloud Console → Credentials',
    isSecret: false,
    group: 'gmail',
  },
  gmail_client_secret: {
    label: 'OAuth2 Client Secret',
    isSecret: true,
    group: 'gmail',
  },
  gmail_refresh_token: {
    label: 'Refresh Token',
    description: 'Obtained via OAuth2 consent (scope: https://mail.google.com/)',
    isSecret: true,
    group: 'gmail',
  },
  gmail_from_address: {
    label: 'From Address',
    description: 'e.g. Sharifur <sharifur@taskip.net>',
    isSecret: false,
    group: 'gmail',
  },
};
