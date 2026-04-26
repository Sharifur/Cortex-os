export interface SettingDefinition {
  label: string;
  description?: string;
  isSecret: boolean;
  group: 'llm' | 'telegram' | 'ses' | 'integrations';
  defaultValue?: string;
}

export const SETTING_DEFINITIONS: Record<string, SettingDefinition> = {
  // LLM — OpenAI
  openai_api_key: {
    label: 'OpenAI API Key',
    description: 'Used for GPT models. Starts with sk-',
    isSecret: true,
    group: 'llm',
  },
  openai_default_model: {
    label: 'OpenAI Default Model',
    description: 'e.g. gpt-4o-mini, gpt-4o',
    isSecret: false,
    group: 'llm',
    defaultValue: 'gpt-4o-mini',
  },

  // LLM — Gemini
  gemini_api_key: {
    label: 'Gemini API Key',
    description: 'Google AI Studio API key',
    isSecret: true,
    group: 'llm',
  },
  gemini_default_model: {
    label: 'Gemini Default Model',
    description: 'e.g. gemini-1.5-flash, gemini-1.5-pro',
    isSecret: false,
    group: 'llm',
    defaultValue: 'gemini-1.5-flash',
  },

  // LLM — DeepSeek
  deepseek_api_key: {
    label: 'DeepSeek API Key',
    description: 'DeepSeek API key',
    isSecret: true,
    group: 'llm',
  },
  deepseek_default_model: {
    label: 'DeepSeek Default Model',
    description: 'e.g. deepseek-chat, deepseek-reasoner',
    isSecret: false,
    group: 'llm',
    defaultValue: 'deepseek-chat',
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

  // SES
  ses_from_address: {
    label: 'SES From Address',
    description: 'e.g. Sharifur <sharifur@taskip.net>',
    isSecret: false,
    group: 'ses',
  },
  ses_configuration_set: {
    label: 'SES Configuration Set',
    isSecret: false,
    group: 'ses',
    defaultValue: 'ses-monitoring',
  },
};
