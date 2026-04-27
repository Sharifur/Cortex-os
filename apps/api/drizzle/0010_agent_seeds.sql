-- Insert missing agents that were added after the initial seed run.
-- ON CONFLICT DO NOTHING keeps existing rows intact.

INSERT INTO "agents" ("id", "key", "name", "description", "enabled", "config")
VALUES
  (
    gen_random_uuid()::text,
    'crisp',
    'Crisp AI Agent',
    'Monitors open Crisp chat conversations every 15 minutes, drafts AI replies, and sends them to Telegram for approval before posting.',
    false,
    '{"replyTone":"friendly, concise, and helpful — like a knowledgeable founder replying to a customer","productContext":"Taskip is a project management SaaS for teams.","maxConversationsPerRun":10,"llm":{"provider":"auto","model":"gpt-4o-mini"}}'::jsonb
  ),
  (
    gen_random_uuid()::text,
    'hr',
    'HR Manager Agent',
    'Generates salary sheets on the 25th, processes leave requests, and sends daily HR alerts (probation endings, contract expirations).',
    false,
    '{"companyName":"Xgenious","currency":"BDT","workingDaysPerMonth":26,"llm":{"provider":"auto","model":"gpt-4o-mini"}}'::jsonb
  ),
  (
    gen_random_uuid()::text,
    'social',
    'Social Media Handler',
    'Publishes scheduled posts and drafts replies to comments/DMs across FB, IG, X, and LinkedIn for Taskip and Xgenious.',
    false,
    '{"brands":["taskip","xgenious"],"platforms":["fb","ig","x","linkedin"],"replyTone":"friendly, professional, adds value — never salesy","llm":{"provider":"auto","model":"gpt-4o-mini"}}'::jsonb
  ),
  (
    gen_random_uuid()::text,
    'canva',
    'Canva + Social Content Agent',
    'Generates a 30-idea monthly content calendar on the 1st of each month and creates Canva designs for approved ideas.',
    false,
    '{"brands":["taskip","xgenious"],"formats":["carousel","reel","post","story","youtube"],"targetCount":30,"brandVoice":"educational, relatable, and slightly witty — for SaaS founders and project managers","llm":{"provider":"openai","model":"gpt-4o"}}'::jsonb
  )
ON CONFLICT ("key") DO NOTHING;
