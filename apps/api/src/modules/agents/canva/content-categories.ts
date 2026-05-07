export type ContentCategory =
  | 'business'
  | 'marketing'
  | 'infographic'
  | 'announcement'
  | 'educational'
  | 'social_proof'
  | 'product'
  | 'seasonal';

export interface CategoryPreset {
  displayName: string;
  description: string;
  defaultTone: string[];
  visualStyle: string;
  colorMood: string;
  typographyStyle: string;
  backgroundDescription: string;
  compositionNotes: string;
  mustHaveElements: string[];
  avoidElements: string[];
  platformSizes: { name: string; width: number; height: number }[];
  carouselStructure: { role: 'cover' | 'content' | 'cta'; label: string; copyHint: string }[];
}

export const CONTENT_CATEGORIES: Record<ContentCategory, CategoryPreset> = {
  business: {
    displayName: 'Business & Corporate',
    description: 'Growth metrics, team updates, strategy announcements, corporate milestones',
    defaultTone: ['professional', 'authoritative', 'confident', 'data-driven'],
    visualStyle:
      'Clean corporate design with strict grid structure. Data-forward layouts. Executive-level polish. Geometric shapes as design elements. Minimal ornamentation.',
    colorMood:
      'Deep navy (#0F172A) or charcoal (#1F2937) as dominant background. Single electric blue (#3B82F6) or gold (#F59E0B) accent. White (#FFFFFF) for all text. No more than 3 colors total.',
    typographyStyle:
      'Bold condensed headline 52–64px, uppercase tracking. Medium weight subheadline 20–22px. Regular body 14–16px. Geometric sans-serif only (Inter, Poppins, Montserrat). Key metrics in oversized 72–96px display treatment.',
    backgroundDescription:
      'Dark navy or charcoal flat background. Optional subtle geometric grid lines at 5% opacity. Clean, zero clutter.',
    compositionNotes:
      'Strict horizontal thirds. Top third: brand logo + label. Middle third: dominant metric or headline. Bottom third: supporting text + CTA. 48px safe margins all sides.',
    mustHaveElements: [
      'brand logo top-left or top-center',
      'key metric or bold claim as hero element',
      'clean grid dividers or separator lines',
      'professional icon set (outline style)',
      'source or date label if data-driven',
    ],
    avoidElements: ['clip art', 'neon colors', 'decorative serif fonts', 'busy photographic backgrounds', 'rounded bubble shapes'],
    platformSizes: [
      { name: 'LinkedIn Post', width: 1200, height: 627 },
      { name: 'LinkedIn Banner', width: 1584, height: 396 },
      { name: 'Instagram Square', width: 1080, height: 1080 },
    ],
    carouselStructure: [
      { role: 'cover',   label: 'Cover: Bold claim or key stat', copyHint: 'One powerful number or statement. No more than 8 words. E.g. "We grew 3x in 12 months"' },
      { role: 'content', label: 'Slide 2: The problem/context', copyHint: 'Set up why this matters. One focused point with supporting data.' },
      { role: 'content', label: 'Slide 3: The evidence', copyHint: 'Chart, comparison, or timeline. Data as the hero.' },
      { role: 'content', label: 'Slide 4: The insight or solution', copyHint: 'What the data means or what you did about it.' },
      { role: 'cta',     label: 'Slide 5: CTA', copyHint: 'Next step: read the report, visit the site, follow for more. Include brand name.' },
    ],
  },

  marketing: {
    displayName: 'Marketing & Promotions',
    description: 'Product launches, sale campaigns, limited-time offers, promotional banners',
    defaultTone: ['energetic', 'persuasive', 'urgent', 'exciting', 'conversion-focused'],
    visualStyle:
      'High-contrast, scroll-stopping layouts. Oversized CTA treatment. Price or offer as typographic hero. Strong visual hierarchy funneling eye to the action.',
    colorMood:
      'Brand primary at full saturation as dominant color. High-contrast accent for CTA (never same family as background). Urgency elements (badge, timer) in red/orange (#EF4444 / #F97316). White text throughout.',
    typographyStyle:
      'Extra-bold display headline 60–80px — the offer IS the headline. Price/discount in 96–120px oversized treatment. CTA button text 18–20px bold. Urgency line 14px in accent color.',
    backgroundDescription:
      'Full-bleed brand color gradient OR product photography with 50% brand-color overlay. No plain white backgrounds.',
    compositionNotes:
      'Z-pattern reading flow. Offer/price top-center as anchor. Product image supporting. CTA button bottom-center, high contrast, minimum 48px height. Badge for urgency top-right.',
    mustHaveElements: [
      'offer or discount in oversized typography',
      'product image or service mockup',
      'CTA button with high contrast',
      'urgency badge or countdown label',
      'brand logo',
    ],
    avoidElements: ['multiple competing CTAs', 'low-contrast text on busy background', 'stock photo hands or laptops', 'too many bullet points'],
    platformSizes: [
      { name: 'Instagram Square', width: 1080, height: 1080 },
      { name: 'Instagram Story', width: 1080, height: 1920 },
      { name: 'Facebook Banner', width: 1200, height: 628 },
    ],
    carouselStructure: [
      { role: 'cover',   label: 'Cover: Offer hook', copyHint: 'The biggest benefit or offer. Bold, immediate. "50% off. This week only." Maximum impact.' },
      { role: 'content', label: 'Slide 2: The pain or desire', copyHint: 'Connect with the audience problem this solves. One focused pain point.' },
      { role: 'content', label: 'Slide 3: Feature 1', copyHint: 'Top feature or benefit. Visual + short label. Icon or screenshot.' },
      { role: 'content', label: 'Slide 4: Feature 2 + social proof', copyHint: 'Second key feature. Add a customer number or review star rating.' },
      { role: 'cta',     label: 'Slide 5: Offer + CTA', copyHint: 'Repeat offer with scarcity. Clear CTA. Link in bio or swipe up.' },
    ],
  },

  infographic: {
    displayName: 'Infographic & Data Visualization',
    description: 'Statistics, comparisons, timelines, how-to guides, step-by-step processes',
    defaultTone: ['educational', 'clear', 'authoritative', 'scannable'],
    visualStyle:
      'Data visualization as the primary design element. Icon-driven. Strong section delineation. Color-coded sections. Built for saving and sharing.',
    colorMood:
      'Light (#F8FAFC) or white background for readability. 3–4 distinct accent colors for sections/steps. Brand color for headings. High contrast throughout for screen and print.',
    typographyStyle:
      'Section numbers in oversized 48px bold display. Section headings bold 18–20px. Body 13–15px regular. Data callouts 28–36px bold. Caption/source 11–12px muted.',
    backgroundDescription:
      'Clean white or very light gray background. Subtle section dividers in 10–15% opacity brand color. No photographic backgrounds.',
    compositionNotes:
      'Vertical flow for portrait; 2-column grid for landscape. Each section self-contained with icon + text + data. Equal visual weight per section. Source attribution footer.',
    mustHaveElements: [
      'numbered or lettered sections with oversized numbers',
      'consistent icon set per point (outline or flat, never mixed)',
      'data points highlighted in bold/color',
      'visual connectors (arrows, lines) between sections',
      'title with key insight',
      'source / date footer',
    ],
    avoidElements: ['dense paragraphs', 'more than 4 colors', 'decorative photography', 'mismatched icon styles'],
    platformSizes: [
      { name: 'Instagram Square', width: 1080, height: 1080 },
      { name: 'Pinterest', width: 1000, height: 1500 },
      { name: 'Instagram Story', width: 1080, height: 1920 },
    ],
    carouselStructure: [
      { role: 'cover',   label: 'Cover: Title + key insight',  copyHint: 'State the most surprising or valuable finding upfront. Make people want to swipe.' },
      { role: 'content', label: 'Slide 2: Data point 1',       copyHint: 'First insight with supporting statistic. Icon + number + 1-sentence explanation.' },
      { role: 'content', label: 'Slide 3: Data point 2',       copyHint: 'Second insight. Different color accent. Same visual template.' },
      { role: 'content', label: 'Slide 4: Data point 3',       copyHint: 'Third insight. Comparison or before/after if relevant.' },
      { role: 'content', label: 'Slide 5: Summary / takeaway', copyHint: 'Synthesize the 3 points into one actionable conclusion.' },
      { role: 'cta',     label: 'Slide 6: Save + follow CTA',  copyHint: '"Save this for later" + brand handle. Infographics are the most saved format — use it.' },
    ],
  },

  announcement: {
    displayName: 'Announcement & News',
    description: 'New features, product launches, company milestones, partnerships, event announcements',
    defaultTone: ['celebratory', 'exciting', 'clear', 'confident', 'momentous'],
    visualStyle:
      'Editorial announcement treatment. Typography as the hero. Bold, clean, high-impact. Feels like a press release made visual.',
    colorMood:
      'Rich full-bleed background in brand primary or deep accent color. White text exclusively. Optional gold/yellow highlight for the announcement label. Celebratory without being kitschy.',
    typographyStyle:
      'ANNOUNCING / NEW / INTRODUCING as a small all-caps label 12–14px tracked. Main headline 64–80px bold or heavy weight. Supporting detail 18–22px regular. Date/version in monospace or light weight.',
    backgroundDescription:
      'Solid deep brand color OR brand color gradient (diagonal, top-left to bottom-right). Optional abstract light beam or geometric shape at 10% opacity for depth.',
    compositionNotes:
      'Centered or left-aligned editorial layout. Announcement label above headline. Headline as the visual anchor. Supporting copy below. Brand logo top or bottom. Maximum 3 text layers.',
    mustHaveElements: [
      'announcement label ("Introducing", "Now Live", "New Feature", "We\'re excited to announce")',
      'main announcement headline',
      'supporting one-line description',
      'brand logo',
      'date or version number if relevant',
    ],
    avoidElements: ['busy photographic backgrounds', 'too many competing elements', 'clipart celebration icons', 'multiple announcements on one slide'],
    platformSizes: [
      { name: 'LinkedIn Post', width: 1200, height: 627 },
      { name: 'Instagram Square', width: 1080, height: 1080 },
      { name: 'Instagram Story', width: 1080, height: 1920 },
    ],
    carouselStructure: [
      { role: 'cover',   label: 'Cover: The announcement',     copyHint: '"Introducing [Name]" — bold, centered, nothing else. Create intrigue.' },
      { role: 'content', label: 'Slide 2: What it is',         copyHint: 'One-paragraph explanation. What it does, not how it works.' },
      { role: 'content', label: 'Slide 3: Why it matters',     copyHint: 'The problem this solves. Customer pain point first, solution second.' },
      { role: 'content', label: 'Slide 4: How to access/join', copyHint: 'Clear instructions. Link, button, or next step. Remove all friction.' },
      { role: 'cta',     label: 'Slide 5: Get started CTA',    copyHint: 'Repeat announcement name + strongest CTA. Link in bio. Tag relevant people.' },
    ],
  },

  educational: {
    displayName: 'Educational & Tips',
    description: 'Tips, tutorials, did-you-know facts, myth vs fact, how-to guides, lessons',
    defaultTone: ['helpful', 'friendly', 'clear', 'approachable', 'trustworthy'],
    visualStyle:
      'Clean card-based layout. Accessible and warm. Each tip/point as its own visual card. Built for saving and sharing. Feels like good advice from a knowledgeable friend.',
    colorMood:
      'Warm neutrals (cream, warm white) or very light pastel backgrounds. Brand color for tip numbers and accents. High readability contrast on all text. One or two accent colors max.',
    typographyStyle:
      'Tip number in brand color 48–56px bold. Tip title 22–26px semibold. Explanation 14–16px regular, line-height 1.6. Friendly humanist sans-serif (DM Sans, Nunito, Plus Jakarta Sans).',
    backgroundDescription:
      'Warm white (#FAFAF9) or cream (#FEF9EF) background. Subtle background card shapes in pastel accent at 15% opacity.',
    compositionNotes:
      'Each slide: number top-left, title center, explanation below, icon top-right. Consistent template across all content slides. Cover breaks the grid for impact.',
    mustHaveElements: [
      'slide number or tip number as visual anchor',
      'icon or illustration per tip (consistent set)',
      'tip title in larger type',
      'brief explanation (max 2 sentences)',
      'swipe indicator or page counter on content slides',
    ],
    avoidElements: ['jargon or technical language', 'dense paragraphs', 'low contrast', 'mixed icon styles', 'more than 40 words per slide'],
    platformSizes: [
      { name: 'Instagram Square', width: 1080, height: 1080 },
      { name: 'Pinterest', width: 1000, height: 1500 },
      { name: 'Instagram Story', width: 1080, height: 1920 },
    ],
    carouselStructure: [
      { role: 'cover',   label: 'Cover: Hook headline',   copyHint: '"X tips to [achieve desirable outcome]" — number creates expectation and completeness bias.' },
      { role: 'content', label: 'Slide 2: Tip 1',         copyHint: 'Most surprising or most valuable tip first. Hook with the unexpected.' },
      { role: 'content', label: 'Slide 3: Tip 2',         copyHint: 'Practical, immediately actionable. Can be done today.' },
      { role: 'content', label: 'Slide 4: Tip 3',         copyHint: 'Slightly more advanced. Rewards those who read all the way.' },
      { role: 'content', label: 'Slide 5: Bonus tip',     copyHint: 'Under-promise, over-deliver. "Bonus:" framing creates delight.' },
      { role: 'cta',     label: 'Slide 6: Save + follow', copyHint: '"Save this so you don\'t forget" + brand handle. Directly ask for the follow. Works.' },
    ],
  },

  social_proof: {
    displayName: 'Testimonials & Social Proof',
    description: 'Customer reviews, case studies, star ratings, client logos, success metrics',
    defaultTone: ['trustworthy', 'authentic', 'confident', 'warm', 'credible'],
    visualStyle:
      'Credibility-first design. Quote as visual centerpiece. Clean and authentic — never salesy. Feels like a real person speaking.',
    colorMood:
      'Neutral light background (white or very light gray) OR brand light tint. Quote text in brand dark color. Attribution and stars in brand accent. Subtle, never shouting.',
    typographyStyle:
      'Oversized quotation marks as decorative graphic element (brand color, 80–120px). Quote text 20–24px regular or italic. Customer name 16px semibold. Company 14px muted. Star rating visual.',
    backgroundDescription:
      'Clean white or brand tint background. Optional subtle texture at 3–5% opacity for warmth. If using photo, customer portrait in circle crop.',
    compositionNotes:
      'Quote anchored center. Large decorative quote marks top-left. Attribution bottom-left with avatar circle if available. Star rating above or below attribution. Brand logo bottom-right.',
    mustHaveElements: [
      'oversized decorative quote marks',
      'full customer quote (authentic, unedited sounding)',
      'customer first name + company',
      'star rating (4 or 5 stars)',
      'result metric if available (e.g. "3x faster", "saved 10hrs/week")',
    ],
    avoidElements: ['generic stock photos', 'fake-looking ratings', 'busy backgrounds that compete with quote', 'too many testimonials on one slide'],
    platformSizes: [
      { name: 'Instagram Square', width: 1080, height: 1080 },
      { name: 'LinkedIn Post', width: 1200, height: 627 },
    ],
    carouselStructure: [
      { role: 'cover',   label: 'Cover: Key result headline',   copyHint: 'The biggest metric result your customers achieve. "Teams save 10+ hours per week." Bold claim.' },
      { role: 'content', label: 'Slide 2: Testimonial 1',       copyHint: 'Most powerful quote. Focus on before/after transformation.' },
      { role: 'content', label: 'Slide 3: Testimonial 2',       copyHint: 'Different customer, different use case. Shows breadth.' },
      { role: 'content', label: 'Slide 4: Case study metric',   copyHint: 'One customer story with specific numbers. Logo + result + quote fragment.' },
      { role: 'cta',     label: 'Slide 5: Try it yourself CTA', copyHint: '"Join [N] teams already using [product]" + CTA. Social proof in the CTA itself.' },
    ],
  },

  product: {
    displayName: 'Product Showcase',
    description: 'Product features, pricing plans, UI demos, comparison tables, mockup reveals',
    defaultTone: ['polished', 'confident', 'desirable', 'premium', 'clear'],
    visualStyle:
      'Product hero treatment. UI or product as the star. Feature callout annotations. Premium studio feel. Every pixel serves the product.',
    colorMood:
      'Dark or deep gradient background makes product screenshot/mockup pop. Brand accent for feature callout lines and badges. White text exclusively. Product interface colors should contrast with background.',
    typographyStyle:
      'Product name in display treatment 48–64px bold. Feature callout labels 13–14px semibold in capsule badges. Price in 72–96px display if pricing slide. Plan names bold 20px.',
    backgroundDescription:
      'Deep dark background (#0A0F1E navy or #111827 slate) for product to float on. Subtle radial glow behind product in brand color at 20% opacity.',
    compositionNotes:
      'Product mockup centered or slightly right with 3D perspective tilt. Feature callout lines extend left with labels. Title above product. CTA below. If pricing: 3-column plan comparison grid.',
    mustHaveElements: [
      'product screenshot or device mockup at high resolution',
      'feature callout annotations with connecting lines',
      'plan name and price if pricing slide',
      'brand logo',
      'platform/device frame around screenshot',
    ],
    avoidElements: ['cluttered backgrounds that compete with product', 'text over the product interface', 'generic device mockups (use brand-consistent ones)', 'too many features per slide'],
    platformSizes: [
      { name: 'Instagram Square', width: 1080, height: 1080 },
      { name: 'LinkedIn Post', width: 1200, height: 628 },
      { name: 'Instagram Story', width: 1080, height: 1920 },
    ],
    carouselStructure: [
      { role: 'cover',   label: 'Cover: Product reveal',    copyHint: 'Product name + one-line value proposition. The hero shot. Make it aspirational.' },
      { role: 'content', label: 'Slide 2: The problem',     copyHint: 'Show the messy before state (spreadsheet hell, manual process). Relatable pain.' },
      { role: 'content', label: 'Slide 3: Key feature 1',   copyHint: 'Biggest differentiating feature. Screenshot + callout annotation + 1-line benefit.' },
      { role: 'content', label: 'Slide 4: Key feature 2',   copyHint: 'Second most compelling feature. Different section of the UI.' },
      { role: 'content', label: 'Slide 5: Pricing/plans',   copyHint: 'Pricing tier comparison. Free tier prominent to reduce friction. Most popular badge.' },
      { role: 'cta',     label: 'Slide 6: Get started CTA', copyHint: '"Start free today" + link. Remove every possible friction word.' },
    ],
  },

  seasonal: {
    displayName: 'Seasonal & Events',
    description: 'Holiday campaigns, seasonal sales, event promotions, date-specific campaigns',
    defaultTone: ['festive', 'warm', 'exciting', 'celebratory', 'inclusive'],
    visualStyle:
      'Seasonal motifs integrated tastefully with brand identity. Not a stock-photo holiday template. On-brand seasonal palette. Sophisticated, not kitschy.',
    colorMood:
      'Seasonal palette harmonized with brand colors. Warmth (amber, gold, cream) for year-end. Freshness (green, yellow) for spring. Keep one brand anchor color always present.',
    typographyStyle:
      'Display font acceptable for seasonal context — script or slab can work if brand allows. Warm and inviting. Bold headline. Legible across all ages.',
    backgroundDescription:
      'Seasonal gradient or brand color with seasonal accent. Optional tasteful seasonal motif (geometric snowflake, abstract leaf, confetti) at 15% opacity. Never full-scene clipart.',
    compositionNotes:
      'Centered layout for seasonal warmth. Seasonal element as background or border frame. Message centered. Offer below message. Brand logo anchored bottom.',
    mustHaveElements: [
      'seasonal occasion label (tasteful, not a stock clipart icon)',
      'main seasonal message or offer',
      'offer details or date range',
      'brand logo',
    ],
    avoidElements: ['overloaded holiday clipart', 'clashing seasonal and brand colors', 'generic stock photography', 'competing multiple seasonal elements'],
    platformSizes: [
      { name: 'Instagram Square', width: 1080, height: 1080 },
      { name: 'Instagram Story', width: 1080, height: 1920 },
      { name: 'Facebook Cover', width: 820, height: 312 },
    ],
    carouselStructure: [
      { role: 'cover',   label: 'Cover: Seasonal greeting + offer', copyHint: 'Warm greeting + the offer in one hit. "Happy Eid — 40% off everything this week."' },
      { role: 'content', label: 'Slide 2: What\'s included',        copyHint: 'List what\'s on offer. Clear, specific. Not "everything" — curate the best items.' },
      { role: 'content', label: 'Slide 3: Highlight product/plan',  copyHint: 'Hero product of the campaign. One item, full attention.' },
      { role: 'content', label: 'Slide 4: Offer terms + urgency',   copyHint: 'End date, coupon code if any, any restrictions. Scarcity done honestly.' },
      { role: 'cta',     label: 'Slide 5: Shop/sign up CTA',        copyHint: 'Brand name + CTA + link. Seasonal sign-off.' },
    ],
  },
};

export const CATEGORY_KEYWORDS: Record<ContentCategory, string[]> = {
  business:     ['business', 'corporate', 'b2b', 'growth', 'revenue', 'metric', 'kpi', 'quarterly', 'report', 'team', 'milestone', 'strategy', 'enterprise'],
  marketing:    ['promotion', 'sale', 'offer', 'discount', 'campaign', 'launch', 'deal', 'limited', 'promo', 'buy', 'shop', 'ad', 'advertisement', 'convert'],
  infographic:  ['infographic', 'statistic', 'stat', 'data', 'comparison', 'timeline', 'step', 'process', 'how to', 'guide', 'chart', 'vs', 'percentage', 'breakdown'],
  announcement: ['announcing', 'introducing', 'new feature', 'now live', 'just launched', 'excited to share', 'announcement', 'partnership', 'milestone', 'we hit'],
  educational:  ['tip', 'tips', 'lesson', 'learn', 'did you know', 'myth', 'fact', 'tutorial', 'how to', 'ways to', 'mistakes', 'avoid', 'improve', 'better'],
  social_proof: ['testimonial', 'review', 'case study', 'customer', 'client', 'rating', 'trusted', 'result', 'success', 'feedback', 'quote', 'said about us'],
  product:      ['product', 'feature', 'pricing', 'plan', 'demo', 'screenshot', 'interface', 'app', 'software', 'saas', 'tool', 'dashboard', 'ui', 'ux'],
  seasonal:     ['holiday', 'christmas', 'eid', 'ramadan', 'new year', 'diwali', 'black friday', 'seasonal', 'event', 'celebration', 'festive', 'special occasion'],
};

export function detectCategory(text: string): ContentCategory | null {
  const lower = text.toLowerCase();
  let best: ContentCategory | null = null;
  let bestScore = 0;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [ContentCategory, string[]][]) {
    const score = keywords.filter((k) => lower.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  return bestScore > 0 ? best : null;
}
