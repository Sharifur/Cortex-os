import { Injectable, Logger } from '@nestjs/common';
import { LlmRouterService } from '../../llm/llm-router.service';
import { KnowledgeEntry } from '../../knowledge-base/knowledge-base.service';

export interface GuardrailInput {
  results: KnowledgeEntry[];
  siteKey: string;
  siteName: string;
  visitorQuery: string;
}

const MIN_QUERY_WORDS = 3;
const RELEVANCE_THRESHOLD = 6;

@Injectable()
export class LivechatKbGuardrailService {
  private readonly logger = new Logger(LivechatKbGuardrailService.name);

  constructor(private llm: LlmRouterService) {}

  async filter(input: GuardrailInput): Promise<KnowledgeEntry[]> {
    const { results, siteKey, siteName, visitorQuery } = input;
    if (!results.length) return [];

    if (!this.isQueryMeaningful(visitorQuery)) {
      this.logger.debug(
        { siteKey, query: visitorQuery.slice(0, 60) },
        'KB guardrail: query rejected (too short or gibberish)',
      );
      return [];
    }

    const siteScoped = results.filter((r) => {
      const keys = (r.siteKeys ?? '').trim();
      if (!keys) {
        this.logger.debug(
          { siteKey, entryId: r.id, title: r.title },
          'KB guardrail: entry rejected (no site_keys tag)',
        );
        return false;
      }
      const listed = keys.split(',').map((k) => k.trim());
      if (!listed.includes(siteKey)) {
        this.logger.debug(
          { siteKey, entryId: r.id, title: r.title, entryTags: keys },
          'KB guardrail: entry rejected (site_keys mismatch)',
        );
        return false;
      }
      return true;
    });

    if (!siteScoped.length) return [];

    return this.scoreRelevance(siteScoped, siteName, visitorQuery);
  }

  private isQueryMeaningful(query: string): boolean {
    const trimmed = query.trim();
    if (trimmed.length < 6) return false;
    const words = trimmed.split(/\s+/).filter((w) => /[a-zA-Z]{2,}/.test(w));
    return words.length >= MIN_QUERY_WORDS;
  }

  private async scoreRelevance(
    entries: KnowledgeEntry[],
    siteName: string,
    query: string,
  ): Promise<KnowledgeEntry[]> {
    if (!entries.length) return [];

    const list = entries.map((e, i) => `${i + 1}. "${e.title}"`).join('\n');
    const prompt = `You are a relevance filter. A visitor on the "${siteName}" support chat asked: "${query.slice(0, 200)}"

The following knowledge base articles are candidates to show as self-service resources:
${list}

For each article, rate its relevance to the visitor's question on a scale 0-10 (10 = directly answers it, 0 = completely unrelated). Return JSON only, no explanation:
{"scores":[<number>,<number>,...]}`;

    try {
      const res = await this.llm.complete({
        agentKey: 'livechat',
        maxTokens: 60,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      });
      const parsed = JSON.parse(res.content);
      const scores: number[] = Array.isArray(parsed?.scores) ? parsed.scores : [];

      const passed: KnowledgeEntry[] = [];
      for (let i = 0; i < entries.length; i++) {
        const score = typeof scores[i] === 'number' ? scores[i] : 0;
        if (score >= RELEVANCE_THRESHOLD) {
          passed.push(entries[i]);
        } else {
          this.logger.debug(
            { entryId: entries[i].id, title: entries[i].title, score, query: query.slice(0, 60) },
            'KB guardrail: entry rejected (low relevance score)',
          );
        }
      }
      return passed;
    } catch (err) {
      this.logger.warn(
        { err: (err as Error).message },
        'KB guardrail: relevance scoring failed, returning unfiltered site-scoped results',
      );
      return entries;
    }
  }
}
