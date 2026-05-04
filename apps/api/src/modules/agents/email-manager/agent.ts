import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { agents, emailItems } from '../../../db/schema';
import { AgentRegistryService } from '../runtime/agent-registry.service';
import { LlmRouterService } from '../../llm/llm-router.service';
import { TelegramService } from '../../telegram/telegram.service';
import { GmailService } from '../../gmail/gmail.service';
import { KnowledgeBaseService } from '../../knowledge-base/knowledge-base.service';
import type {
  IAgent,
  TriggerSpec,
  TriggerEvent,
  RunContext,
  AgentContext,
  ProposedAction,
  ActionResult,
  McpToolDefinition,
  AgentApiRoute,
} from '../runtime/types';
import { agentLlmOpts } from '../runtime/llm-config.util';

type Classification = 'must-reply' | 'nice-to-reply' | 'newsletter' | 'spam';
type Sentiment = 'positive' | 'neutral' | 'frustrated' | 'demanding';

interface EmailManagerConfig {
  maxEmailsPerRun: number;
  importantSenders: string[];
  autoArchiveDomains: string[];
  llm?: { provider?: string; model?: string };
}

interface EmailSnapshot {
  newMessages: {
    id: string;
    threadId: string;
    from: string;
    subject: string;
    snippet: string;
    body: string;
    receivedAt: string;
  }[];
  config: EmailManagerConfig;
  taskMode?: boolean;
  instructions?: string;
  imageData?: { base64: string; mimeType: string };
}

// Result from image extraction — structured so thread context and latest message are separate
interface ExtractedEmail {
  latestMessage: string;
  threadContext: string;
  sender: string;
  subject: string;
  language: string;
  sentiment: Sentiment;
  confidence: number; // 0–1: how confident we are this is actually an email
}

const CLASSIFY_SYSTEM = `You are an email classifier for Sharifur Rahman, founder of Taskip and Xgenious.
Classify the email into exactly one category:
- must-reply: customer, partner, investor, or important business contact who needs a response
- nice-to-reply: potentially useful but not urgent
- newsletter: marketing, announcements, digests, automated emails
- spam: unsolicited, irrelevant, or junk

Reply with ONLY the category name, nothing else.`;

const DRAFT_SYSTEM = `You are Sharifur Rahman's email assistant. Write a concise, professional reply.
Keep it under 100 words. Be warm but direct. Do not include a subject line — just the reply body.`;

const CLIENT_REPLY_SYSTEM = `You are Sharifur Rahman's email assistant for client onboarding and sales.
Your job is to draft a professional reply to the client email provided.

Output format — use exactly this structure:
Subject: Re: [original subject or a fitting subject if unclear]

[reply body]

Best regards,
Sharifur
Taskip / Xgenious

Rules:
- Lead directly with the answer. No "Thank you for reaching out", no filler opening.
- CRITICAL: Before saying anything about a product, check the Knowledge Base sections below (Products, Key Facts, Relevant Knowledge). If the KB has information about the product, use it to answer every question. Never say a product is "not in our lineup" or "not listed" if it appears in the KB.
- PRICING RULE: If pricing is present in the KB, quote the exact figure. Never redirect to a pricing page or say "pricing varies" when the number is in the KB.
- Use KB facts for features, timelines, tech stack, and technical details. Do not guess or fabricate.
- Only say "I will confirm and get back to you shortly" for details genuinely absent from the KB — never for the product itself.
- If the client asks multiple questions, answer each one in order using KB facts. Do not skip any question.
- Keep the body 100–250 words. Longer for complex multi-question emails, shorter for simple ones.
- Match the client's language (English, Bangla, Arabic, etc.) — the language note in the prompt tells you which one.
- End with one clear next step or action for the client.`;

// Improved heuristic — covers pre-sale, technical, forwarded, and non-English emails
function looksLikeClientEmail(text: string): boolean {
  if (text.length < 60) return false;
  const lower = text.toLowerCase();
  const lineCount = (text.match(/\n/g) ?? []).length;
  const hasEmailHeaders = /^from:\s/im.test(text) || /^subject:\s/im.test(text) || /^date:\s/im.test(text);
  const isForwarded = /\bfwd?:\s|------\s*forwarded|begin forwarded/i.test(text);
  const hasGreeting = /\b(dear|hello|hi|greetings|assalamu|salam)\s+\w/i.test(text);
  const hasSenderIntro = /\bmy name is\b|\bi am from\b|\bi'm from\b|\bour company\b|\bwe are\b|\bour firm\b|\bour team\b/i.test(text);
  const hasClientSignals =
    lower.includes('purchase') || lower.includes('license') ||
    lower.includes('envato') || lower.includes('codecanyon') || lower.includes('support') ||
    lower.includes('install') || lower.includes('price') || lower.includes('refund') ||
    lower.includes('invoice') || lower.includes('order') || lower.includes('payment') ||
    lower.includes('interested in') || lower.includes('planning to') || lower.includes('before purchasing') ||
    lower.includes('before proceeding') || lower.includes('self-host') || lower.includes('white-label') ||
    lower.includes('whitelabel') || lower.includes('reskin') || lower.includes('technical question') ||
    lower.includes('integration') || lower.includes('buy') || lower.includes('demo') ||
    lower.includes('trial') || lower.includes('looking forward') || lower.includes('database') ||
    lower.includes('multi-tenancy') || lower.includes('saas') || lower.includes('flutter') ||
    lower.includes('mobile app') || lower.includes('api') || lower.includes('documentation');
  return hasEmailHeaders || isForwarded ||
    (lineCount >= 5 && (hasClientSignals || hasGreeting || hasSenderIntro)) ||
    (lineCount >= 3 && hasClientSignals);
}

// Extract likely product names from email — capitalized words (4+ chars) that appear 2+ times
// and are not common English words. Catches "Nazmart", "Taskip", "Xgenious", "Intoday", etc.
function extractProductNames(text: string): string[] {
  const SKIP = new Set([
    'From', 'Subject', 'Date', 'Dear', 'Hello', 'Best', 'Thanks', 'Thank', 'Please', 'Just',
    'Also', 'Very', 'Your', 'Their', 'This', 'That', 'With', 'Have', 'Been', 'Will', 'Would',
    'Could', 'Should', 'Must', 'Such', 'Each', 'Some', 'Into', 'Over', 'Upon', 'Before', 'After',
    'Looking', 'Forward', 'Hearing', 'Regards', 'Sincerely', 'Team', 'Company', 'Platform',
    'Service', 'Support', 'Email', 'Reply', 'Message', 'Client', 'Product', 'Project', 'Google',
    'Store', 'AppStore', 'Play', 'Flutter', 'Laravel', 'WordPress', 'Database', 'Server',
  ]);
  const matches = text.match(/\b[A-Z][a-zA-Z]{3,}\b/g) ?? [];
  const freq = new Map<string, number>();
  for (const w of matches) {
    if (!SKIP.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return Array.from(freq.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

function buildSentimentNote(sentiment: Sentiment): string {
  switch (sentiment) {
    case 'frustrated': return '\nTone note: client appears frustrated — acknowledge their concern briefly in the first sentence before answering.';
    case 'demanding': return '\nTone note: client is demanding/urgent — be concise and action-oriented; avoid anything that sounds dismissive.';
    case 'positive': return '\nTone note: client is enthusiastic — match their energy; be warm and forward-moving.';
    default: return '';
  }
}

@Injectable()
export class EmailManagerAgent implements IAgent, OnModuleInit {
  readonly key = 'email_manager';
  readonly name = 'Email Manager';
  private readonly logger = new Logger(EmailManagerAgent.name);

  constructor(
    private db: DbService,
    private llm: LlmRouterService,
    private telegram: TelegramService,
    private gmail: GmailService,
    private registry: AgentRegistryService,
    private kb: KnowledgeBaseService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  triggers(): TriggerSpec[] {
    return [{ type: 'CRON', cron: '*/30 * * * *' }];
  }

  async buildContext(trigger: TriggerEvent, run: RunContext): Promise<AgentContext> {
    const config = await this.getConfig();
    const payload = trigger.payload as Record<string, unknown> | null;
    if (payload?._taskId) {
      return {
        source: trigger,
        snapshot: { taskMode: true, instructions: (payload.instructions as string) ?? '', newMessages: [], config },
        followups: [],
      };
    }
    if (payload?.query) {
      const imageData = payload.imageData as { base64: string; mimeType: string } | undefined;
      return {
        source: trigger,
        snapshot: {
          taskMode: true,
          instructions: String(payload.query),
          imageData,
          newMessages: [],
          config,
        },
        followups: (run.context as AgentContext | null)?.followups ?? [],
      };
    }

    const isConfigured = await this.gmail.isConfigured();
    if (!isConfigured) {
      return { source: trigger, snapshot: { newMessages: [], config, skip: true }, followups: [] };
    }

    const messages = await this.gmail.listUnread(config.maxEmailsPerRun);
    if (!messages.length) {
      return { source: trigger, snapshot: { newMessages: [], config }, followups: [] };
    }

    const existingIds = messages.map((m) => m.id);
    const existing = await this.db.db
      .select({ externalMsgId: emailItems.externalMsgId })
      .from(emailItems)
      .where(inArray(emailItems.externalMsgId, existingIds));

    const existingSet = new Set(existing.map((r) => r.externalMsgId));
    const newMessages = messages.filter((m) => !existingSet.has(m.id));

    this.logger.log(`buildContext: ${messages.length} unread, ${newMessages.length} new`);

    const snapshot: EmailSnapshot = {
      newMessages: newMessages.map((m) => ({
        id: m.id,
        threadId: m.threadId,
        from: m.from,
        subject: m.subject,
        snippet: m.snippet,
        body: m.body.slice(0, 2000),
        receivedAt: m.receivedAt.toISOString(),
      })),
      config,
    };

    return { source: trigger, snapshot, followups: (run.context as AgentContext | null)?.followups ?? [] };
  }

  async decide(ctx: AgentContext): Promise<ProposedAction[]> {
    const snapshot = ctx.snapshot as EmailSnapshot & { skip?: boolean };
    if (snapshot.taskMode) {
      const followupNote = ctx.followups?.at(-1)?.text;
      return this.decideTaskMode(snapshot.instructions ?? '', snapshot.config, followupNote, snapshot.imageData);
    }
    if (snapshot.skip || !snapshot.newMessages.length) return [];

    const { newMessages, config } = snapshot;
    const actions: ProposedAction[] = [];

    const [alwaysOn, samples, blocklist, rejections] = await Promise.all([
      this.kb.getAlwaysOnContext(this.key),
      this.kb.getWritingSamples(this.key),
      this.kb.getBlocklistRules(this.key),
      this.kb.getRecentRejections(this.key, 3),
    ]);
    const template = await this.kb.getPromptTemplate(this.key);

    for (const msg of newMessages) {
      const classification = await this.classify(msg, config);

      await this.db.db.insert(emailItems).values({
        externalMsgId: msg.id,
        threadId: msg.threadId,
        from: msg.from,
        subject: msg.subject,
        snippet: msg.snippet,
        classification,
        status: 'new',
        receivedAt: new Date(msg.receivedAt),
      }).onConflictDoNothing();

      if (classification === 'newsletter' || classification === 'spam') {
        actions.push({
          type: 'archive_email',
          summary: `Archive "${msg.subject}" (${classification})`,
          payload: { messageId: msg.id, externalMsgId: msg.id, classification },
          riskLevel: 'low',
        });
      } else if (classification === 'must-reply') {
        const references = await this.kb.searchEntries(`${msg.subject} ${msg.snippet}`, this.key, 5);
        const kbBlock = this.kb.buildKbPromptBlock({
          voiceProfile: alwaysOn.find(e => e.entryType === 'voice_profile') ?? null,
          facts: alwaysOn.filter(e => e.entryType === 'fact'),
          references,
          positiveSamples: samples.filter(s => s.polarity === 'positive'),
          negativeSamples: samples.filter(s => s.polarity === 'negative'),
          rejections,
        });
        let draft = await this.draftReply(msg, config, template?.system, kbBlock);
        draft = await this.selfCritique(draft, alwaysOn.find(e => e.entryType === 'voice_profile')?.content, blocklist);
        const violation = blocklist.find(p => draft.toLowerCase().includes(p.toLowerCase()));

        await this.db.db
          .update(emailItems)
          .set({ draftReply: draft, status: 'draft_ready' })
          .where(eq(emailItems.externalMsgId, msg.id));

        actions.push({
          type: 'send_reply',
          summary: `Reply to "${msg.subject}" from ${msg.from}${violation ? ` - Blocklist: "${violation}"` : ''}`,
          payload: { messageId: msg.id, threadId: msg.threadId, from: msg.from, subject: msg.subject, draft },
          riskLevel: violation ? 'high' : 'medium',
        });
      } else {
        actions.push({
          type: 'notify_email',
          summary: `Notify: new email from ${msg.from} — "${msg.subject}"`,
          payload: { messageId: msg.id, from: msg.from, subject: msg.subject, snippet: msg.snippet },
          riskLevel: 'low',
        });
      }
    }

    return actions;
  }

  requiresApproval(action: ProposedAction): boolean {
    return action.type === 'send_reply';
  }

  async execute(action: ProposedAction): Promise<ActionResult> {
    switch (action.type) {
      case 'notify_result':
        return { success: true, data: { draft: (action.payload as { message?: string }).message } };

      case 'archive_email': {
        const { messageId, externalMsgId, classification } = action.payload as {
          messageId: string; externalMsgId: string; classification: string;
        };
        await this.gmail.archiveMessage(messageId);
        await this.gmail.markRead(messageId);
        await this.db.db
          .update(emailItems)
          .set({ status: 'archived', processedAt: new Date() })
          .where(eq(emailItems.externalMsgId, externalMsgId));
        return { success: true, data: { archived: true, classification } };
      }

      case 'notify_email': {
        const { from, subject, snippet } = action.payload as {
          messageId: string; from: string; subject: string; snippet: string;
        };
        await this.telegram.sendMessage(
          `New email (nice-to-reply)\nFrom: ${from}\nSubject: ${subject}\n\n${snippet}`,
        );
        await this.db.db
          .update(emailItems)
          .set({ status: 'notified', processedAt: new Date() })
          .where(eq(emailItems.externalMsgId, (action.payload as any).messageId));
        return { success: true, data: { notified: true } };
      }

      case 'send_reply': {
        const { messageId, threadId, from, subject, draft } = action.payload as {
          messageId: string; threadId: string; from: string; subject: string; draft: string;
        };
        const toAddress = from.match(/<(.+)>/)?.[1] ?? from;
        const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
        await this.gmail.sendEmail({
          to: toAddress,
          from: await this.gmail.getFromAddress(),
          subject: replySubject,
          textBody: draft,
        });
        await this.gmail.markRead(messageId);
        await this.db.db
          .update(emailItems)
          .set({ status: 'sent', processedAt: new Date() })
          .where(eq(emailItems.externalMsgId, messageId));
        return { success: true, data: { sent: true, to: toAddress } };
      }

      default:
        return { success: false, error: `Unknown action: ${action.type}` };
    }
  }

  mcpTools(): McpToolDefinition[] {
    return [
      {
        name: 'list_unread',
        description: 'List unread emails from Gmail inbox',
        inputSchema: { type: 'object', properties: { maxResults: { type: 'number', default: 10 } } },
        handler: async (input) => {
          const { maxResults = 10 } = input as { maxResults?: number };
          return this.gmail.listUnread(maxResults);
        },
      },
      {
        name: 'get_thread',
        description: 'Fetch a full Gmail thread by thread ID',
        inputSchema: { type: 'object', properties: { threadId: { type: 'string' } }, required: ['threadId'] },
        handler: async (input) => {
          const { threadId } = input as { threadId: string };
          return this.gmail.getThread(threadId);
        },
      },
      {
        name: 'draft_reply',
        description: 'LLM-draft a reply for an email by its external message ID',
        inputSchema: { type: 'object', properties: { messageId: { type: 'string' } }, required: ['messageId'] },
        handler: async (input) => {
          const { messageId } = input as { messageId: string };
          const msg = await this.gmail.getMessage(messageId);
          const config = await this.getConfig();
          const draft = await this.draftReply(
            { subject: msg.subject, from: msg.from, body: msg.body.slice(0, 2000), snippet: msg.snippet },
            config,
          );
          return { draft };
        },
      },
      {
        name: 'archive',
        description: 'Archive an email by message ID',
        inputSchema: { type: 'object', properties: { messageId: { type: 'string' } }, required: ['messageId'] },
        handler: async (input) => {
          const { messageId } = input as { messageId: string };
          await this.gmail.archiveMessage(messageId);
          return { archived: true };
        },
      },
      {
        name: 'label',
        description: 'Apply a Gmail label to a message',
        inputSchema: {
          type: 'object',
          properties: { messageId: { type: 'string' }, labelName: { type: 'string' } },
          required: ['messageId', 'labelName'],
        },
        handler: async (input) => {
          const { messageId, labelName } = input as { messageId: string; labelName: string };
          await this.gmail.addLabel(messageId, labelName);
          return { labeled: true, labelName };
        },
      },
    ];
  }

  apiRoutes(): AgentApiRoute[] {
    return [
      {
        method: 'GET',
        path: '/email-manager/unread',
        requiresAuth: true,
        handler: async () => this.gmail.listUnread(20),
      },
      {
        method: 'POST',
        path: '/email-manager/draft-reply/:msgId',
        requiresAuth: true,
        handler: async (params) => {
          const msgId = (params as { msgId: string }).msgId;
          const msg = await this.gmail.getMessage(msgId);
          const config = await this.getConfig();
          const draft = await this.draftReply(
            { subject: msg.subject, from: msg.from, body: msg.body.slice(0, 2000), snippet: msg.snippet },
            config,
          );
          return { draft };
        },
      },
    ];
  }

  private async decideTaskMode(
    instructions: string,
    config: EmailManagerConfig,
    followupNote?: string,
    imageData?: { base64: string; mimeType: string },
  ): Promise<ProposedAction[]> {
    const [alwaysOn, samples, blocklist, rejections] = await Promise.all([
      this.kb.getAlwaysOnContext(this.key),
      this.kb.getWritingSamples(this.key),
      this.kb.getBlocklistRules(this.key),
      this.kb.getRecentRejections(this.key, 3),
    ]);

    const effectiveInstructions = followupNote
      ? `${instructions}\n\nAdditional note: ${followupNote}`
      : instructions;

    // --- Image path ---
    if (imageData) {
      const extracted = await this.extractEmailFromImage(imageData, effectiveInstructions);

      // Confidence check: if gpt-4o isn't sure this is an email, tell the user
      if (extracted.confidence < 0.5) {
        return [{
          type: 'notify_result',
          summary: 'Could not identify a clear email in the image. Please paste the email as text instead.',
          payload: { message: 'Could not identify a clear email in the image. Please paste the email as text instead.' },
          riskLevel: 'low',
        }];
      }

      // Vision extracted a real email — route to client reply
      return this.draftClientReply(
        extracted.latestMessage,
        extracted.threadContext,
        extracted.language,
        extracted.sentiment,
        config,
        alwaysOn,
        samples,
        blocklist,
        rejections,
      );
    }

    // --- Text path ---
    if (looksLikeClientEmail(effectiveInstructions)) {
      // Detect language and sentiment with a fast single call
      const analysis = await this.analyzeEmailText(effectiveInstructions).catch(() => ({
        language: 'en', sentiment: 'neutral' as Sentiment,
      }));
      return this.draftClientReply(
        effectiveInstructions,
        '',
        analysis.language,
        analysis.sentiment,
        config,
        alwaysOn,
        samples,
        blocklist,
        rejections,
      );
    }

    // Compose path — general email writing from instructions
    const template = await this.kb.getPromptTemplate(this.key);
    const kbBlock = this.kb.buildKbPromptBlock({
      voiceProfile: alwaysOn.find(e => e.entryType === 'voice_profile') ?? null,
      facts: alwaysOn.filter(e => e.entryType === 'fact'),
      catalog: alwaysOn.filter(e => e.entryType === 'product' || e.entryType === 'service' || e.entryType === 'offer'),
      references: [],
      positiveSamples: samples.filter(s => s.polarity === 'positive'),
      negativeSamples: samples.filter(s => s.polarity === 'negative'),
      rejections,
    });
    const defaultSystem = `You are Sharifur Rahman's email assistant. Write a concise, professional email based on the given instructions. Keep it under 150 words. Be warm but direct. Do not include a subject line — just the email body.`;
    const response = await this.llm.complete({
      messages: [
        { role: 'system', content: (template?.system ?? defaultSystem) + kbBlock },
        { role: 'user', content: effectiveInstructions },
      ],
      ...agentLlmOpts(config),
      agentKey: this.key,
      maxTokens: 450,
      temperature: 0.7,
    });
    let draft = response.content.trim();
    if (!draft) return [{ type: 'noop', summary: 'No draft generated.', payload: {}, riskLevel: 'low' }];
    draft = await this.selfCritique(draft, alwaysOn.find(e => e.entryType === 'voice_profile')?.content, blocklist);
    return [{ type: 'notify_result', summary: draft, payload: { message: draft }, riskLevel: 'low' }];
  }

  private async draftClientReply(
    emailText: string,
    threadContext: string,
    language: string,
    sentiment: Sentiment,
    config: EmailManagerConfig,
    alwaysOn: Awaited<ReturnType<KnowledgeBaseService['getAlwaysOnContext']>>,
    samples: Awaited<ReturnType<KnowledgeBaseService['getWritingSamples']>>,
    blocklist: string[],
    rejections: Awaited<ReturnType<KnowledgeBaseService['getRecentRejections']>>,
  ): Promise<ProposedAction[]> {
    // Primary semantic search on first 1200 chars
    const semanticRefs = await this.kb.searchEntries(emailText.slice(0, 1200), this.key, 15).catch(() => []);

    // Product-name targeted search: extract names like "Nazmart", "Taskip" from the email
    // and do an additional search per product so those KB entries always rank in
    const productNames = extractProductNames(emailText);
    const productRefs = await Promise.all(
      productNames.map(name => this.kb.searchEntries(name, this.key, 5).catch(() => [])),
    );
    // Merge, deduplicate by entry id
    const seenIds = new Set(semanticRefs.map((r: any) => r.id));
    const allRefs = [...semanticRefs];
    for (const batch of productRefs) {
      for (const ref of batch) {
        if (!seenIds.has((ref as any).id)) {
          seenIds.add((ref as any).id);
          allRefs.push(ref);
        }
      }
    }

    const kbBlock = this.kb.buildKbPromptBlock({
      voiceProfile: alwaysOn.find(e => e.entryType === 'voice_profile') ?? null,
      facts: alwaysOn.filter(e => e.entryType === 'fact'),
      catalog: alwaysOn.filter(e => e.entryType === 'product' || e.entryType === 'service' || e.entryType === 'offer'),
      references: allRefs,
      positiveSamples: samples.filter(s => s.polarity === 'positive'),
      negativeSamples: samples.filter(s => s.polarity === 'negative'),
      rejections,
    });

    const sentimentNote = buildSentimentNote(sentiment);
    const languageNote = language && language !== 'en'
      ? `\nLanguage note: the client wrote in ${language} — draft your reply in ${language}.`
      : '';
    const systemContent = CLIENT_REPLY_SYSTEM + sentimentNote + languageNote + kbBlock;

    // Build messages: if we have thread context (from image extraction), include it
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemContent },
    ];
    if (threadContext.trim()) {
      messages.push({ role: 'user', content: `Thread context (earlier messages — for background only):\n${threadContext.slice(0, 1500)}` });
      messages.push({ role: 'assistant', content: 'Understood. I have read the thread context.' });
    }
    messages.push({ role: 'user', content: emailText.slice(0, 3000) });

    const response = await this.llm.complete({
      messages,
      ...agentLlmOpts(config),
      provider: 'openai',
      model: 'gpt-4o',
      agentKey: this.key,
      maxTokens: 900,
      temperature: 0.6,
    });
    let draft = response.content.trim();
    if (!draft) return [{ type: 'noop', summary: 'No draft generated.', payload: {}, riskLevel: 'low' }];
    draft = await this.selfCritique(draft, alwaysOn.find(e => e.entryType === 'voice_profile')?.content, blocklist);
    return [{ type: 'notify_result', summary: draft, payload: { message: draft }, riskLevel: 'low' }];
  }

  // Extract structured email data from an image screenshot
  private async extractEmailFromImage(
    imageData: { base64: string; mimeType: string },
    fallbackText: string,
  ): Promise<ExtractedEmail> {
    const fallback: ExtractedEmail = {
      latestMessage: fallbackText,
      threadContext: '',
      sender: '',
      subject: '',
      language: 'en',
      sentiment: 'neutral',
      confidence: 0.3,
    };
    try {
      const response = await this.llm.complete({
        provider: 'openai',
        model: 'gpt-4o',
        agentKey: this.key,
        maxTokens: 1200,
        temperature: 0,
        imageBase64: imageData.base64,
        imageMimeType: imageData.mimeType,
        messages: [
          {
            role: 'system',
            content: `You are an email content extractor. Your job is to read an image and return a JSON object.

IMPORTANT:
- Focus ONLY on the email message content. Ignore browser chrome, sidebar navigation, labels, toolbar buttons, and any UI elements.
- If the image shows a thread (multiple messages), separate the LATEST (most recent) message from earlier messages.
- Detect the language the client is writing in (use ISO 639-1 code: en, ar, bn, fr, etc.).
- Rate your confidence that this image contains an actual email (0.0 = definitely not an email, 1.0 = clearly an email).
- Classify the client's emotional tone: positive / neutral / frustrated / demanding.

Return ONLY valid JSON in this exact format:
{
  "latestMessage": "the most recent client message, full text",
  "threadContext": "any earlier messages in the thread, or empty string",
  "sender": "sender name and/or email if visible",
  "subject": "email subject if visible",
  "language": "en",
  "sentiment": "neutral",
  "confidence": 0.95
}`,
          },
          { role: 'user', content: 'Extract the email data from this image.' },
        ],
      });
      const raw = response.content.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
      const parsed = JSON.parse(raw) as Partial<ExtractedEmail>;
      if (!parsed.latestMessage || parsed.latestMessage.length < 20) return fallback;
      return {
        latestMessage: parsed.latestMessage ?? fallbackText,
        threadContext: parsed.threadContext ?? '',
        sender: parsed.sender ?? '',
        subject: parsed.subject ?? '',
        language: parsed.language ?? 'en',
        sentiment: (['positive', 'neutral', 'frustrated', 'demanding'].includes(parsed.sentiment ?? ''))
          ? (parsed.sentiment as Sentiment) : 'neutral',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      };
    } catch (err) {
      this.logger.warn(`Image email extraction failed: ${(err as Error).message}`);
      return fallback;
    }
  }

  // Quick language + sentiment analysis for text-path emails (single LLM call, cheap)
  private async analyzeEmailText(text: string): Promise<{ language: string; sentiment: Sentiment }> {
    const res = await this.llm.complete({
      provider: 'openai',
      model: 'gpt-4o-mini',
      agentKey: this.key,
      maxTokens: 30,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: 'Return JSON only: {"language":"ISO-639-1 code","sentiment":"positive|neutral|frustrated|demanding"}',
        },
        { role: 'user', content: text.slice(0, 500) },
      ],
    });
    try {
      const parsed = JSON.parse(res.content.trim().replace(/^```json\s*/i, '').replace(/```$/, ''));
      return {
        language: typeof parsed.language === 'string' ? parsed.language : 'en',
        sentiment: (['positive', 'neutral', 'frustrated', 'demanding'].includes(parsed.sentiment))
          ? parsed.sentiment as Sentiment : 'neutral',
      };
    } catch {
      return { language: 'en', sentiment: 'neutral' };
    }
  }

  private async classify(
    msg: { from: string; subject: string; snippet: string; body: string },
    config: EmailManagerConfig,
  ): Promise<Classification> {
    const fromLower = msg.from.toLowerCase();
    if (config.importantSenders?.some((s) => fromLower.includes(s.toLowerCase()))) return 'must-reply';
    if (config.autoArchiveDomains?.some((d) => fromLower.includes(d.toLowerCase()))) return 'newsletter';

    const res = await this.llm.complete({
      ...agentLlmOpts(config),
      agentKey: this.key,
      messages: [
        { role: 'system', content: CLASSIFY_SYSTEM },
        { role: 'user', content: `From: ${msg.from}\nSubject: ${msg.subject}\n\n${msg.snippet}` },
      ],
      maxTokens: 20,
      temperature: 0,
    });
    const raw = res.content.trim().toLowerCase();
    if (raw.includes('must-reply')) return 'must-reply';
    if (raw.includes('nice-to-reply')) return 'nice-to-reply';
    if (raw.includes('newsletter')) return 'newsletter';
    return 'spam';
  }

  private async draftReply(
    msg: { from: string; subject: string; snippet: string; body: string },
    config: EmailManagerConfig,
    customSystem?: string,
    kbBlock = '',
  ): Promise<string> {
    const res = await this.llm.complete({
      ...agentLlmOpts(config),
      agentKey: this.key,
      messages: [
        { role: 'system', content: (customSystem ?? DRAFT_SYSTEM) + kbBlock },
        { role: 'user', content: `From: ${msg.from}\nSubject: ${msg.subject}\n\n${msg.body || msg.snippet}` },
      ],
      maxTokens: 300,
      temperature: 0.7,
    });
    return res.content.trim();
  }

  private async selfCritique(draft: string, voiceProfile?: string, blocklist?: string[]): Promise<string> {
    try {
      const critique = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: `You are a strict editor. Review this email reply draft.
Voice: ${voiceProfile ?? 'warm, direct, under 100 words'}
Avoid: ${blocklist?.join(', ') || 'none specified'}
If the draft is good, return: {"ok":true}
If not, rewrite and return: {"ok":false,"revised":"improved reply here"}`,
          },
          { role: 'user', content: `Draft: "${draft}"` },
        ],
        agentKey: this.key,
        maxTokens: 250,
      });
      const result = JSON.parse(critique.content);
      if (!result.ok && result.revised) return result.revised.trim();
    } catch {
      // fail-open
    }
    return draft;
  }

  private async getConfig(): Promise<EmailManagerConfig> {
    const [row] = await this.db.db
      .select({ config: agents.config })
      .from(agents)
      .where(eq(agents.key, this.key));
    return (row?.config as EmailManagerConfig) ?? this.defaultConfig();
  }

  private defaultConfig(): EmailManagerConfig {
    return { maxEmailsPerRun: 20, importantSenders: [], autoArchiveDomains: [] };
  }
}
