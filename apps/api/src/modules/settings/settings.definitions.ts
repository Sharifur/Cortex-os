export interface SettingDefinition {
  label: string;
  description?: string;
  isSecret: boolean;
  group: 'llm' | 'telegram' | 'ses' | 'gmail' | 'whatsapp' | 'linkedin' | 'reddit' | 'crisp' | 'license' | 'storage' | 'insight' | 'safety';
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
    description: 'Model used for text generation tasks',
    isSecret: false,
    group: 'llm',
    defaultValue: 'gpt-4o-mini',
    provider: 'openai',
  },
  openai_embedding_model: {
    label: 'Embedding Model',
    description: 'Model used for vector embeddings in the knowledge base',
    isSecret: false,
    group: 'llm',
    defaultValue: 'text-embedding-3-small',
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
  ses_webhook_token: {
    label: 'Webhook URL Token',
    description: 'Random secret appended to the SNS subscription URL (e.g. /ses/webhook?t=…). Required to accept any SNS notification.',
    isSecret: true,
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

  // WhatsApp Business Cloud API
  whatsapp_api_token: {
    label: 'API Token (Bearer)',
    description: 'Permanent system user token from Meta Business Suite → System Users',
    isSecret: true,
    group: 'whatsapp',
  },
  whatsapp_phone_number_id: {
    label: 'Phone Number ID',
    description: 'Found in Meta for Developers → WhatsApp → API Setup',
    isSecret: false,
    group: 'whatsapp',
  },
  whatsapp_verify_token: {
    label: 'Webhook Verify Token',
    description: 'Any random string you choose — must match the value in Meta webhook config',
    isSecret: true,
    group: 'whatsapp',
    defaultValue: 'cortex-whatsapp-verify',
  },
  whatsapp_app_secret: {
    label: 'App Secret',
    description: 'From Meta for Developers → App Settings → Basic → App Secret. Used to verify X-Hub-Signature-256 on inbound webhooks.',
    isSecret: true,
    group: 'whatsapp',
  },

  // LinkedIn — Unipile (preferred) or direct OAuth2
  unipile_api_key: {
    label: 'Unipile API Key',
    description: 'From app.unipile.com → Settings → API Keys (preferred method)',
    isSecret: true,
    group: 'linkedin',
  },
  unipile_dsn: {
    label: 'Unipile DSN',
    description: 'Your account DSN from Unipile dashboard (e.g. api4.unipile.com:13444)',
    isSecret: false,
    group: 'linkedin',
  },
  linkedin_access_token: {
    label: 'LinkedIn Access Token (fallback)',
    description: 'Direct OAuth2 access token — only used if Unipile is not configured',
    isSecret: true,
    group: 'linkedin',
  },

  // Reddit — script app OAuth2
  reddit_client_id: {
    label: 'Client ID',
    description: 'From reddit.com/prefs/apps → script app → client ID (below app name)',
    isSecret: false,
    group: 'reddit',
  },
  reddit_client_secret: {
    label: 'Client Secret',
    isSecret: true,
    group: 'reddit',
  },
  reddit_username: {
    label: 'Reddit Username',
    description: 'The account that will post comments',
    isSecret: false,
    group: 'reddit',
  },
  reddit_password: {
    label: 'Reddit Password',
    isSecret: true,
    group: 'reddit',
  },

  // Crisp live chat
  crisp_website_id: {
    label: 'Website ID',
    description: 'From Crisp → Settings → Website → Setup → Website ID',
    isSecret: false,
    group: 'crisp',
  },
  crisp_api_identifier: {
    label: 'API Identifier',
    description: 'From Crisp → Settings → Website → API Keys → Identifier',
    isSecret: false,
    group: 'crisp',
  },
  crisp_api_key: {
    label: 'API Key',
    description: 'From Crisp → Settings → Website → API Keys → Key (treat as secret)',
    isSecret: true,
    group: 'crisp',
  },
  crisp_webhook_signing_secret: {
    label: 'Webhook Signing Secret',
    description: 'From Crisp → Settings → Website → Hooks → "View signing secret". Used to verify incoming webhook HMAC.',
    isSecret: true,
    group: 'crisp',
  },

  // License Server
  license_server_url: {
    label: 'License Server URL',
    description: 'Base URL of the Xgenious license server, e.g. https://license.xgenious.com',
    isSecret: false,
    group: 'license',
  },
  license_server_signature: {
    label: 'API Signature',
    description: 'X-Signature token from Dashboard → Public API → Create (starts with xs_)',
    isSecret: true,
    group: 'license',
  },
  license_account_type: {
    label: 'Default Envato Account',
    description: 'Envato account slug to try first, e.g. xgenious or bytesed',
    isSecret: false,
    group: 'license',
    defaultValue: 'xgenious',
  },

  // Storage — Cloudflare R2 (S3-compatible)
  storage_endpoint: {
    label: 'Endpoint',
    description: '<account-id>.r2.cloudflarestorage.com — find Account ID in Cloudflare Dashboard → R2',
    isSecret: false,
    group: 'storage',
  },
  storage_access_key: {
    label: 'Access Key ID',
    description: 'R2 API token Access Key ID',
    isSecret: true,
    group: 'storage',
  },
  storage_secret_key: {
    label: 'Secret Access Key',
    description: 'R2 API token Secret Access Key',
    isSecret: true,
    group: 'storage',
  },
  storage_bucket: {
    label: 'Bucket Name',
    description: 'e.g. cortex',
    isSecret: false,
    group: 'storage',
    defaultValue: 'cortex',
  },
  storage_port: {
    label: 'Port',
    description: '443 for R2/HTTPS, 9000 for local MinIO',
    isSecret: false,
    group: 'storage',
    defaultValue: '443',
  },
  storage_use_ssl: {
    label: 'Use SSL',
    description: 'true for R2 / any HTTPS endpoint, false for local dev',
    isSecret: false,
    group: 'storage',
    defaultValue: 'true',
  },

  // Taskip Insight API
  insight_base_url: {
    label: 'Base URL',
    description: 'e.g. https://taskip.net/api/internal/insight',
    isSecret: false,
    group: 'insight',
  },
  insight_agent_key_primary: {
    label: 'Agent Key — Primary',
    description: 'Sent in X-Insight-Agent-Key header',
    isSecret: true,
    group: 'insight',
  },
  insight_agent_key_secondary: {
    label: 'Agent Key — Secondary (rotation)',
    description: 'Optional. Used as fallback during zero-downtime key rotation',
    isSecret: true,
    group: 'insight',
  },

  // Safety — global kill switches for agent write actions
  kill_extend_trial: {
    label: 'Block extend_trial',
    description: 'When true, the taskip_internal agent cannot extend trials even if approved',
    isSecret: false,
    group: 'safety',
    defaultValue: 'false',
  },
  kill_mark_refund: {
    label: 'Block mark_refund',
    description: 'When true, blocks the refund-marking action',
    isSecret: false,
    group: 'safety',
    defaultValue: 'false',
  },
  kill_send_email: {
    label: 'Block send_email',
    description: 'When true, blocks the Gmail outbound action across agents',
    isSecret: false,
    group: 'safety',
    defaultValue: 'false',
  },
  kill_marketing_suggestion: {
    label: 'Block insight_submit_marketing_suggestion',
    description: 'When true, blocks marketing-suggestion writeback to Taskip',
    isSecret: false,
    group: 'safety',
    defaultValue: 'false',
  },
  kill_lifecycle_message: {
    label: 'Block insight_submit_message',
    description: 'When true, blocks lifecycle messaging (email + in-app) submitted via the Insight API',
    isSecret: false,
    group: 'safety',
    defaultValue: 'false',
  },
};
