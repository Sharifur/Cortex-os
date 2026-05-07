import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { DesignBrief } from './adapters/types';

export interface SkillMeta {
  name: string;
  description: string;
  triggers: string[];
  backendHints: string[];
  dir: string;
}

export interface ScoredSkill {
  skill: SkillMeta;
  score: number;
}

@Injectable()
export class SkillLoaderService implements OnModuleInit {
  private readonly logger = new Logger(SkillLoaderService.name);
  private index: SkillMeta[] = [];

  private get skillsRoot(): string {
    return path.join(__dirname, 'skills');
  }

  async onModuleInit() {
    await this.reindex();
  }

  async reindex(): Promise<void> {
    try {
      const entries = await fs.readdir(this.skillsRoot, { withFileTypes: true });
      const metas: SkillMeta[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillPath = path.join(this.skillsRoot, entry.name, 'SKILL.md');
        try {
          const raw = await fs.readFile(skillPath, 'utf-8');
          const meta = this.parseFrontmatter(raw, path.join(this.skillsRoot, entry.name));
          if (meta) metas.push(meta);
        } catch { /* skip malformed skills */ }
      }

      this.index = metas;
      this.logger.log(`Skill index: ${metas.map((m) => m.name).join(', ')}`);
    } catch (err) {
      this.logger.warn(`Skill indexing failed: ${(err as Error).message}`);
    }
  }

  match(brief: DesignBrief, topN = 3): ScoredSkill[] {
    const query = `${brief.intent} ${brief.subject} ${brief.tone.join(' ')}`.toLowerCase();

    const scored = this.index.map((skill) => {
      let score = 0;

      // Trigger keyword match
      for (const trigger of skill.triggers) {
        if (query.includes(trigger.toLowerCase())) score += 0.3;
      }

      // Intent → backend hint alignment
      const intentBackend = this.intentBackendHint(brief.intent);
      if (skill.backendHints.includes(intentBackend)) score += 0.4;

      // Description word overlap
      const descWords = skill.description.toLowerCase().split(/\s+/);
      const queryWords = new Set(query.split(/\s+/));
      const overlap = descWords.filter((w) => queryWords.has(w)).length;
      score += Math.min(overlap * 0.05, 0.3);

      return { skill, score };
    });

    return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, topN);
  }

  async loadContent(skillName: string): Promise<string> {
    const meta = this.index.find((s) => s.name === skillName);
    if (!meta) return '';
    try {
      return fs.readFile(path.join(meta.dir, 'SKILL.md'), 'utf-8');
    } catch {
      return '';
    }
  }

  private intentBackendHint(intent: string): string {
    const map: Record<string, string> = {
      social_post: 'canva',
      presentation: 'canva',
      marketing_banner: 'canva',
      infographic: 'canva',
      print: 'canva',
      logo: 'ai_image',
      illustration: 'ai_image',
      custom: 'canva',
    };
    return map[intent] ?? 'canva';
  }

  private parseFrontmatter(raw: string, dir: string): SkillMeta | null {
    const match = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;
    const fm = match[1];

    const get = (key: string): string => {
      const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
      return m?.[1]?.trim() ?? '';
    };

    const getArray = (key: string): string[] => {
      const m = fm.match(new RegExp(`^${key}:\\s*\\[(.*)\\]`, 'm'));
      if (!m) return [];
      return m[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    };

    const name = get('name');
    if (!name) return null;

    return {
      name,
      description: get('description'),
      triggers: getArray('triggers'),
      backendHints: getArray('backend_hints'),
      dir,
    };
  }
}
