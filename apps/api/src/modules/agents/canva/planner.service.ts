import { Injectable } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import type { DesignBrief, DesignIntent, GenerationPlan, GenerationTask, BackendType } from './adapters/types';

interface BackendSelection {
  primary: BackendType;
  secondary?: BackendType;
  notes: string;
}

const BACKEND_MATRIX: Record<DesignIntent, BackendSelection> = {
  social_post:       { primary: 'canva', secondary: 'ai_image', notes: 'Brand kit honored; composite variant uses AI illustration' },
  presentation:      { primary: 'canva',                        notes: 'generate-design-structured + outline review' },
  marketing_banner:  { primary: 'canva', secondary: 'ai_image', notes: 'Composite when illustration is needed' },
  logo:              { primary: 'ai_image', secondary: 'local', notes: 'Vectorize via downstream tool if needed' },
  infographic:       { primary: 'canva', secondary: 'local',   notes: 'Data overlays via Pillow' },
  print:             { primary: 'canva',                        notes: 'Exported as PDF' },
  illustration:      { primary: 'ai_image', secondary: 'local', notes: 'Photo-real or stylized' },
  custom:            { primary: 'canva', secondary: 'ai_image', notes: 'Ask clarifying question first' },
};

@Injectable()
export class PlannerService {
  plan(sessionId: string, brief: DesignBrief, matchedSkills: string[]): GenerationPlan {
    const selection = BACKEND_MATRIX[brief.intent];
    const tasks: GenerationTask[] = [];

    const primarySkill = matchedSkills[0] ?? this.defaultSkill(brief.intent, selection.primary);

    // Always produce at least one primary backend task per candidate
    const canvaCount = selection.primary === 'canva' ? brief.nCandidates : Math.ceil(brief.nCandidates / 2);
    const aiCount = selection.secondary === 'ai_image' ? Math.floor(brief.nCandidates / 2) : 0;
    const localCount = selection.secondary === 'local' ? 1 : 0;

    for (let i = 0; i < canvaCount && selection.primary === 'canva'; i++) {
      tasks.push({
        id: createId(),
        backend: 'canva',
        skill: primarySkill,
        brief,
        variant: String.fromCharCode(65 + i), // A, B, C
        rationale: `${selection.notes} — variant ${String.fromCharCode(65 + i)}`,
      });
    }

    for (let i = 0; i < (selection.primary === 'ai_image' ? brief.nCandidates : aiCount); i++) {
      const aiSkill = matchedSkills.find((s) => s.startsWith('ai-')) ?? this.defaultSkill(brief.intent, 'ai_image');
      tasks.push({
        id: createId(),
        backend: 'ai_image',
        skill: aiSkill,
        brief,
        variant: String.fromCharCode(65 + (canvaCount > 0 ? canvaCount : 0) + i),
        rationale: selection.primary === 'ai_image' ? selection.notes : `Composite: AI illustration layer — ${selection.notes}`,
      });
    }

    for (let i = 0; i < localCount; i++) {
      tasks.push({
        id: createId(),
        backend: 'local',
        skill: 'local-text-overlay',
        brief,
        variant: String.fromCharCode(65 + canvaCount + aiCount + i),
        rationale: 'Quick local render for text-on-image overlay',
      });
    }

    // Trim to requested candidate count
    const finalTasks = tasks.slice(0, brief.nCandidates);

    return { sessionId, brief, tasks: finalTasks };
  }

  private defaultSkill(intent: DesignIntent, backend: BackendType): string {
    if (backend === 'canva') {
      const map: Partial<Record<DesignIntent, string>> = {
        social_post: 'canva-social-post',
        presentation: 'canva-presentation',
        marketing_banner: 'canva-marketing-banner',
        infographic: 'canva-marketing-banner',
        print: 'canva-marketing-banner',
        custom: 'canva-social-post',
      };
      return map[intent] ?? 'canva-social-post';
    }
    if (backend === 'ai_image') {
      return intent === 'illustration' ? 'ai-illustration' : 'ai-photo-realistic';
    }
    return 'local-text-overlay';
  }
}
