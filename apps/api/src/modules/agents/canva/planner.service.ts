import { Injectable } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import type { BackendType, DesignBrief, DesignIntent, GenerationPlan, GenerationTask } from './adapters/types';

const INTENT_NOTES: Record<DesignIntent, string> = {
  social_post:      'Brand voice + palette applied to image prompt',
  presentation:     'Slide-by-slide brief with headline and body per slide',
  marketing_banner: 'Rich layout description drives image composition',
  logo:             'Brand palette and style directions in prompt',
  infographic:      'Data visualization concept with elements list',
  print:            'Print-ready composition with brand identity',
  illustration:     'Mood and style keywords drive illustration style',
  custom:           'Detailed brief passed directly to generation backend',
};

@Injectable()
export class PlannerService {
  plan(sessionId: string, brief: DesignBrief, matchedSkills: string[], backend: BackendType = 'ai_image'): GenerationPlan {
    const notes = INTENT_NOTES[brief.intent];
    const skill = matchedSkills[0] ?? this.defaultSkill(brief.intent);
    const tasks: GenerationTask[] = [];

    if (brief.isCarousel && brief.carouselSlides?.length) {
      for (const slide of brief.carouselSlides) {
        const slideBrief: DesignBrief = {
          ...brief,
          isCarousel: false,
          subject: slide.headline || brief.subject,
          copy: { headline: slide.headline, body: slide.body, cta: slide.cta },
          elements: slide.elements.length > 0 ? slide.elements : brief.elements,
          layoutDescription: slide.visualFocus,
          colorDirections: slide.colorAccent
            ? `Accent: ${slide.colorAccent}. Base: ${brief.colorDirections ?? ''}`
            : brief.colorDirections,
          platformContext: `Carousel slide ${slide.slideNumber} of ${brief.carouselSlides!.length} — role: ${slide.role}. ${brief.platformContext ?? ''}`,
        };
        tasks.push({ id: createId(), backend, skill, brief: slideBrief, variant: `S${slide.slideNumber}`, rationale: `${slide.label} — ${notes}` });
      }
    } else {
      for (let i = 0; i < brief.nCandidates; i++) {
        tasks.push({ id: createId(), backend, skill, brief, variant: String.fromCharCode(65 + i), rationale: `${notes} — variant ${String.fromCharCode(65 + i)}` });
      }
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
