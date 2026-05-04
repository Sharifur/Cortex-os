import { BookMarked, ShieldCheck, Layers, GitBranch, AlertTriangle, Database, Activity } from 'lucide-react';

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <span className="text-primary">{icon}</span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-muted/30 border border-border rounded-lg p-4 text-xs font-mono whitespace-pre overflow-x-auto leading-relaxed">
      {children}
    </pre>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30 border-b border-border">
            {headers.map((h) => (
              <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-xs font-mono">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    red: 'bg-red-500/15 text-red-400 border-red-500/30',
    orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${colorMap[color] ?? colorMap.blue}`}>
      {children}
    </span>
  );
}

export default function KbFrameworkPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-10">
      <div className="flex items-start gap-3">
        <BookMarked className="w-6 h-6 text-primary mt-0.5 shrink-0" />
        <div>
          <h1 className="text-xl font-semibold">KB Access Framework</h1>
          <p className="text-sm text-muted-foreground mt-1">
            How AI agents must read from the Knowledge Base — layers, retrieval protocol, prompt format, security scoping, quality gates, and failure handling.
          </p>
        </div>
      </div>

      {/* Why */}
      <div className="rounded-lg border border-border bg-muted/10 p-4 text-sm text-muted-foreground space-y-1">
        <p className="text-foreground font-medium text-sm">Why this framework exists</p>
        <p>Without a protocol, agents query KB ad-hoc, skip quality gates, and hallucinate. The cross-site KB contamination and grounding failures addressed in Sprint 9 both originated from missing protocol discipline. This framework defines the mandatory contract every KB-enabled agent must follow.</p>
      </div>

      {/* Layer Model */}
      <Section icon={<Layers className="w-4 h-4" />} title="Layer Model">
        <p className="text-sm text-muted-foreground">KB access is a four-layer pipeline. Every layer runs in order. Skipping any layer breaks the quality guarantee.</p>
        <div className="space-y-2">
          {[
            { num: '0', label: 'Security', color: 'red', desc: 'siteKey + agentKey scoping — enforced at query level before any data is returned' },
            { num: '1', label: 'Always-On Context', color: 'purple', desc: 'voice_profile, facts, products/services/offers — injected unconditionally, never searched' },
            { num: '2', label: 'Retrieved Context', color: 'blue', desc: 'reference entries matched via hybrid FTS + vector search on a thread-enriched query' },
            { num: '3', label: 'Behavioral Context', color: 'green', desc: 'writing samples (positive/negative), recent rejections — shapes tone and avoids known mistakes' },
            { num: '4', label: 'Guard Rails', color: 'orange', desc: 'blocklist enforcement, self-critique, grounding check — post-draft quality gates' },
          ].map((l) => (
            <div key={l.num} className="flex items-start gap-3 rounded-lg border border-border px-4 py-3">
              <span className="text-xs font-mono text-muted-foreground shrink-0 w-4">L{l.num}</span>
              <Badge color={l.color}>{l.label}</Badge>
              <p className="text-xs text-muted-foreground">{l.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 9-Step Contract */}
      <Section icon={<GitBranch className="w-4 h-4" />} title="Agent Contract — Mandatory 9-Step Sequence">
        <p className="text-sm text-muted-foreground">
          Every agent that generates text using KB data must execute all 9 steps in this order.
          Steps marked <Badge color="red">HARD STOP</Badge> discard the draft and escalate to human support — they cannot be bypassed or caught.
        </p>
        <div className="space-y-1.5">
          {[
            { n: 1, label: 'Build retrieval query', stop: false, detail: 'Prepend last 3 messages to current message. Never search on the current message alone — a one-word follow-up ("yes", "how much?") resolves nothing without context.' },
            { n: 2, label: 'Parallel fetch all KB data', stop: false, detail: 'getAlwaysOnContext · searchEntries(limit=8) · getWritingSamples · getBlocklistRules · getRecentRejections(n=3) — all in a single Promise.all.' },
            { n: 3, label: 'Pre-LLM KB coverage gate', stop: true, detail: 'If no catalog entry exists AND references.length === 0 AND intent is substantive → escalate + saveKbGap("no_references"). Prevents the LLM from hallucinating on an empty KB.' },
            { n: 4, label: 'Assemble prompt block', stop: false, detail: 'Call buildKbPromptBlock(). Never hand-craft a KB section — the function enforces all truncation limits and section ordering.' },
            { n: 5, label: 'Generate draft via LLM', stop: false, detail: 'Standard LLM call with system prompt (includes KB block) + visitor message.' },
            { n: 6, label: 'Self-critique loop', stop: false, detail: 'Skip only for trivial intents: greeting, thanks, leaving, affirmation. Max 1 retry (selfCritiqueRetries config).' },
            { n: 7, label: 'Blocklist check', stop: true, detail: 'If any blocklist pattern appears in the draft → escalate + saveKbGap("blocklist_hit"). Never edit around a violation — always escalate.' },
            { n: 8, label: 'Grounding check', stop: true, detail: 'A fast secondary LLM call verifies that specific factual claims in the draft are supported by KB entries. If ungrounded → escalate + saveKbGap("grounding_failed").' },
            { n: 9, label: 'Record kbSources in reply metadata', stop: false, detail: 'Store { kbSources: [{id, title, entryType}] } in message metadata. Enables the KB debug panel and source flagging in the operator UI.' },
          ].map((step) => (
            <div key={step.n} className="flex items-start gap-3 rounded-lg border border-border px-4 py-3">
              <span className="text-xs font-mono text-muted-foreground shrink-0 w-4">{step.n}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{step.label}</span>
                  {step.stop && <Badge color="red">HARD STOP</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Retrieval Protocol */}
      <Section icon={<Database className="w-4 h-4" />} title="Retrieval Protocol">
        <Table
          headers={['Parameter', 'Required', 'Rule']}
          rows={[
            ['query', 'yes', 'Thread-enriched (Step 1) — never raw current message alone'],
            ['agentKey', 'yes', "Agent's registered key — mandatory for agent scoping"],
            ['siteKey', 'conditional', 'Required for livechat-class agents; null = admin/global view'],
            ['limit', 'yes', 'Default 8, max 20'],
            ['vectorThreshold', 'fixed', '0.40 cosine distance (≥ 0.60 similarity) — not configurable per-call'],
          ]}
        />
        <Code>{`// Hybrid retrieval — FTS + vector in parallel, merged via RRF
const [fts, vec] = await Promise.all([ftsSearch(query), vectorSearch(query)]);
const results = reciprocalRankFusion(fts, vec, limit);  // k=60, priority as tiebreaker

// After returning results, fire-and-forget update of last_retrieved_at
void db.update(knowledgeEntries)
  .set({ lastRetrievedAt: new Date() })
  .where(inArray(knowledgeEntries.id, results.map(r => r.id)));`}</Code>
      </Section>

      {/* Prompt Block Format */}
      <Section icon={<BookMarked className="w-4 h-4" />} title="Prompt Block Format">
        <p className="text-sm text-muted-foreground">
          Always call <code className="text-xs bg-muted px-1 py-0.5 rounded">buildKbPromptBlock()</code> — never hand-craft the KB section in a system prompt.
          Section order and truncation limits are fixed.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Table
            headers={['Section', 'Entry type', 'Limit']}
            rows={[
              ['Voice & Style', 'voice_profile', '600 chars'],
              ['Key Facts', 'fact', '800 chars total'],
              ['What You Can Pitch', 'product / service / offer', '500 chars each'],
              ['Relevant Knowledge', 'reference', '800 chars each, max 8'],
              ['Write Like This', 'writing_sample (positive)', '400 chars each, max 3'],
              ['Never Write Like This', 'writing_sample (negative)', '200 chars each, max 2'],
              ['Avoid These Mistakes', 'rejection', '150 chars each, max 3'],
            ]}
          />
          <Code>{`buildKbPromptBlock({
  voiceProfile,        // single entry or null
  facts,               // entryType === 'fact'
  catalog,             // product | service | offer
  references,          // from searchEntries()
  positiveSamples,     // polarity === 'positive'
  negativeSamples,     // polarity === 'negative'
  rejections,          // string[] from getRecentRejections()
  threadHistory,       // optional last N messages
})`}</Code>
        </div>
      </Section>

      {/* Security */}
      <Section icon={<ShieldCheck className="w-4 h-4" />} title="Security Protocol">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <p className="text-sm font-medium">Site scoping — <code className="text-xs bg-muted px-1 py-0.5 rounded">siteKeyWhere()</code></p>
            <Table
              headers={['siteKey value', 'Behaviour']}
              rows={[
                ['undefined', 'No filter — admin / ingestion only'],
                ['null', 'Entries with no site scope (admin KB review)'],
                ['"taskip"', 'ONLY entries explicitly tagged "taskip"'],
              ]}
            />
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400">
              No fallback to unscoped entries for site-specific queries. An entry with no site_keys is invisible to livechat agents.
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium">Agent scoping — <code className="text-xs bg-muted px-1 py-0.5 rounded">agentKeyWhere()</code></p>
            <Table
              headers={['agentKeys value', 'Behaviour']}
              rows={[
                ['undefined', 'No filter — admin only'],
                ['null (on entry)', 'Available to all agents (global)'],
                ['"livechat,support"', 'Only returned for listed agents'],
              ]}
            />
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
              Blocklist is a hard stop. Never edit a response to avoid a violation — always escalate.
            </div>
          </div>
        </div>
      </Section>

      {/* Quality Gates */}
      <Section icon={<AlertTriangle className="w-4 h-4" />} title="Quality Gate Pipeline">
        <div className="space-y-2">
          {[
            { phase: 'Pre-retrieval', gate: 'Thread-enriched query', action: 'Build query from last 3 messages + current message', color: 'blue' },
            { phase: 'Pre-LLM', gate: 'KB coverage gate', action: 'No catalog + no references + substantive intent → escalate', color: 'orange' },
            { phase: 'Post-draft', gate: 'Self-critique loop', action: 'Refine tone/style (max 1 retry); skip trivial intents', color: 'green' },
            { phase: 'Post-draft', gate: 'Blocklist check', action: 'Pattern match → escalate + saveKbGap("blocklist_hit")', color: 'red' },
            { phase: 'Post-draft', gate: 'Grounding check', action: 'Unverified claim → escalate + saveKbGap("grounding_failed")', color: 'red' },
            { phase: 'Post-draft', gate: 'Disclosure filter', action: 'Replace any AI self-reveal language with safe deflection', color: 'purple' },
          ].map((g, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border px-4 py-2.5">
              <span className="text-[10px] font-mono text-muted-foreground w-20 shrink-0">{g.phase}</span>
              <Badge color={g.color}>{g.gate}</Badge>
              <p className="text-xs text-muted-foreground">{g.action}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Metadata & Escalation */}
      <Section icon={<Database className="w-4 h-4" />} title="Metadata Contract & Escalation Logging">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Message metadata (every AI reply)</p>
            <Code>{`// Stored in livechat_messages.metadata
{
  kbSources: [
    { id: string, title: string, entryType: string }
  ]
}
// max 20 sources = references + alwaysOn catalog/facts
// omit if kbSources is empty`}</Code>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Escalation logging (all KB failures)</p>
            <Code>{`// Stored in livechat_kb_gaps
saveKbGap({
  siteKey,
  sessionId,
  visitorQuestion,
  escalationReason:
    | 'no_references'
    | 'grounding_failed'
    | 'blocklist_hit'
})`}</Code>
          </div>
        </div>
      </Section>

      {/* Failure Table */}
      <Section icon={<AlertTriangle className="w-4 h-4" />} title="Failure / Fallback Protocol">
        <Table
          headers={['Failure mode', 'Gate', 'Action']}
          rows={[
            ['No catalog + no references', 'Pre-LLM', 'postFallback() + saveKbGap("no_references")'],
            ['Blocklist match in draft', 'Post-draft', 'postFallback() + saveKbGap("blocklist_hit")'],
            ['Draft claim not in KB', 'Post-draft', 'postFallback() + saveKbGap("grounding_failed")'],
            ['KB service throws', 'Any step', 'Log error + postFallback() silently'],
            ['Vector search unavailable', 'Retrieval', 'FTS-only fallback — no escalation'],
          ]}
        />
        <div className="rounded-lg border border-border bg-muted/10 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">postFallback()</strong> — sends a standard "let me connect you with the team" message, pushes a notification to the human operator, and leaves the session open for takeover.
        </div>
      </Section>

      {/* Health Indicators */}
      <Section icon={<Activity className="w-4 h-4" />} title="Health Indicators">
        <p className="text-sm text-muted-foreground">KB is degrading when any of these signals appear. Check the KB Gaps tab and Entries tab regularly.</p>
        <Table
          headers={['Signal', 'Threshold', 'Action']}
          rows={[
            ['KB Gaps tab spike', '>5 gaps/hour for a site', 'Add KB entries for that site'],
            ['"never used" badge on reference entries', 'Any on an active site', 'Review content quality or re-embed'],
            ['"stale" badge on entries', '>30 days unretrieved', 'Delete or update the entry'],
            ['Grounding failures on same topic', '2+ in 24h for same site', 'KB entry is outdated or contradicts LLM draft'],
            ['"no site — inactive" badge', 'Any livechat entry', 'Add a site key immediately'],
          ]}
        />
      </Section>

      {/* Key Files */}
      <Section icon={<Database className="w-4 h-4" />} title="Key Files">
        <Table
          headers={['File', 'Purpose']}
          rows={[
            ['apps/api/src/modules/knowledge-base/knowledge-base.service.ts', 'Core KB service — buildKbPromptBlock, searchEntries, getAlwaysOnContext'],
            ['apps/api/src/modules/agents/livechat/agent.ts', 'Reference implementation — full 9-step contract'],
            ['apps/api/src/modules/agents/livechat/livechat.service.ts', 'saveKbGap(), flagKbSource()'],
            ['apps/api/src/modules/knowledge-base/schema.ts', 'knowledgeEntries, writingSamples, promptTemplates, kbProposals'],
            ['apps/api/src/modules/agents/livechat/schema.ts', 'livechat_kb_gaps (0052), livechat_kb_flags (0053)'],
            ['apps/web/src/pages/KnowledgeBasePage.tsx', 'KB admin UI — Entries, Samples, Import, Templates, Proposals, Gaps'],
          ]}
        />
      </Section>
    </div>
  );
}
