INSERT INTO "agents" ("id", "key", "name", "description", "enabled", "config", "created_at", "updated_at")
VALUES (
  'agent_telegram_bot',
  'telegram_bot',
  'Telegram Bot',
  'Conversational front door for Telegram. Handles smalltalk, detects reminders/tasks, and delegates everything else to the right agent (Daily Reminder, Email Manager, Crisp, LinkedIn, etc.).',
  true,
  '{"llm":{"provider":"auto","model":"gpt-4o-mini"}}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT ("key") DO NOTHING;
