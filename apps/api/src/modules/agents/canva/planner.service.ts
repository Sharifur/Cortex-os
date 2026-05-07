import { Injectable } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import type { DesignBrief, DesignIntent, GenerationPlan, GenerationTask } from './adapters/types';

interface BackendSelection {
  primary: 'canva';
  notes: string;
}

const BACKEND_MATRIX: Record<DesignIntent, BackendSelection> = {
  social_post:      { primary: 'canva', notes: 'Brand kit applied; detailed brief drives template selection' },
  presentation:     { primary: 'canva', notes: 'generate-design-structured + outline review' },
  marketing_banner: { primary: 'canva', notes: 'Rich layout description passed to Canva structured generation' },
  logo:             { primary: 'canva', notes: 'Canva brand kit + logo template with detailed style directions' },
  infographic:      { primary: 'canva', notes: 'Data visualization template; elements list drives content' },
  print:            { primary: 'canva', notes: 'Exported as PDF with full brand kit' },
  illustration:     { primary: 'canva', notes: 'Canva illustration template with mood and style directions' },
  custom:           { primary: 'canva', notes: 'Detailed brief drives best-fit template selection' },
};

@Injectable()
export class PlannerService {
  plan(sessionId: string, brief: DesignBrief, matchedSkills: string[]): GenerationPlan {
    const selection = BACKEND_MATRIX[brief.intent];
    const skill = matchedSkills[0] ?? this.defaultSkill(brief.intent);

    const tasks: GenerationTask[] = [];
    for (let i = 0; i < brief.nCandidates; i++) {
      tasks.push({
        id: createId(),
        backend: 'canva',
        skill,
        brief,
        variant: String.fromCharCode(65 + i), // A, B, C …
        rationale: `${selection.notes} — variant ${String.fromCharCode(65 + i)}`,
      });
    }

    return { sessionId, brief, tasks };
  }

  private defaultSkill(intent: DesignIntent): string {
    const map: Record<DesignIntent, string> = {
      social_post:      'canva-social-post',
      presentation:     'canva-presentation',
      marketing_banner: 'canva-marketing-banner',
      logo:             'canva-social-post',
      infographic:      'canva-marketing-banner',
      print:            'canva-marketing-banner',
      illustration:     'canva-social-post',
      custom:           'canva-social-post',
    };
    return map[intent];
  }
}
