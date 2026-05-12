import type { PostFormat } from './types';

// Cover → N content slides → CTA slide pattern for carousels
const carouselCover = (n: number): import('./types').SlideSchema => ({
  role: 'cover',
  layout: 'centered',
  styleRules: {
    backgroundVariant: 'brand-primary',
    backgroundType: 'solid',
    textPrimary: 'auto',
    accentType: 'top-bar',
    showLogo: true,
    showSlideIndicator: false,
    showBrandBar: true,
  },
  slots: [
    { id: 'headline', type: 'headline', required: true, maxChars: 60, constraints: ['punchy hook', 'include a number if possible'], hint: `Cover headline for ${n}-slide carousel. Creates curiosity, includes a specific number.` },
    { id: 'body', type: 'body', required: false, maxChars: 100, constraints: ['sets context', 'no fluff'], hint: 'Short supporting line under the headline.' },
  ],
});

const carouselContent = (slideHint: string): import('./types').SlideSchema => ({
  role: 'content',
  layout: 'left-aligned',
  styleRules: {
    backgroundVariant: 'white',
    backgroundType: 'solid',
    textPrimary: 'dark',
    accentType: 'left-stripe',
    showLogo: false,
    showSlideIndicator: true,
    showBrandBar: false,
  },
  slots: [
    { id: 'headline', type: 'headline', required: true, maxChars: 50, constraints: ['action-oriented', 'no emoji'], hint: slideHint },
    { id: 'body', type: 'body', required: true, maxChars: 180, constraints: ['3–4 sentences max', 'concrete and specific'], hint: 'Supporting detail for this point.' },
  ],
});

const listContent = (slideHint: string): import('./types').SlideSchema => ({
  role: 'list',
  layout: 'list-layout',
  styleRules: {
    backgroundVariant: 'white',
    backgroundType: 'solid',
    textPrimary: 'dark',
    accentType: 'left-stripe',
    showLogo: false,
    showSlideIndicator: true,
    showBrandBar: false,
  },
  slots: [
    { id: 'headline', type: 'headline', required: true, maxChars: 50, constraints: ['no emoji'], hint: slideHint },
    { id: 'list_items', type: 'list_items', required: true, maxChars: 200, constraints: ['3–5 items', 'each under 40 chars', 'parallel structure'], hint: 'Bullet list items.' },
  ],
});

const carouselCta = (): import('./types').SlideSchema => ({
  role: 'cta',
  layout: 'centered',
  styleRules: {
    backgroundVariant: 'brand-secondary',
    backgroundType: 'solid',
    textPrimary: 'auto',
    accentType: 'bottom-bar',
    showLogo: true,
    showSlideIndicator: false,
    showBrandBar: true,
  },
  slots: [
    { id: 'headline', type: 'headline', required: true, maxChars: 50, constraints: ['strong action verb', 'direct'], hint: 'CTA headline. Example: "Start Your Free Trial".' },
    { id: 'cta', type: 'cta', required: true, maxChars: 60, constraints: ['URL or short action phrase'], hint: 'URL or action. Example: "taskip.app/signup".' },
  ],
});

const singleCard = (role: import('./types').SlideRole, layout: import('./types').LayoutType, bg: import('./types').BackgroundVariant, slots: import('./types').ContentSlot[]): import('./types').SlideSchema => ({
  role,
  layout,
  styleRules: {
    backgroundVariant: bg,
    backgroundType: 'solid',
    textPrimary: 'auto',
    accentType: 'top-bar',
    showLogo: true,
    showSlideIndicator: false,
    showBrandBar: true,
  },
  slots,
});

export const POST_FORMAT_REGISTRY: PostFormat[] = [
  // ─── LinkedIn ───────────────────────────────────────────────────────────────
  {
    id: 'linkedin-tips-carousel',
    name: 'LinkedIn Tips Carousel',
    description: '6-slide tips carousel for LinkedIn. Cover → 4 tips → CTA.',
    platform: 'linkedin',
    category: 'carousel',
    dimensions: { width: 1080, height: 1080 },
    slides: [
      carouselCover(4),
      carouselContent('Tip 1 headline — actionable, starts with a verb.'),
      carouselContent('Tip 2 headline — actionable, starts with a verb.'),
      carouselContent('Tip 3 headline — actionable, starts with a verb.'),
      carouselContent('Tip 4 headline — actionable, starts with a verb.'),
      carouselCta(),
    ],
  },
  {
    id: 'linkedin-howto-carousel',
    name: 'LinkedIn How-To Steps',
    description: '5-slide how-to carousel. Cover → 3 steps → CTA.',
    platform: 'linkedin',
    category: 'carousel',
    dimensions: { width: 1080, height: 1080 },
    slides: [
      carouselCover(3),
      carouselContent('Step 1: What to do first. Start with "Step 1:" prefix.'),
      carouselContent('Step 2: Next action. Start with "Step 2:" prefix.'),
      carouselContent('Step 3: Final step. Start with "Step 3:" prefix.'),
      carouselCta(),
    ],
  },
  {
    id: 'linkedin-stat-single',
    name: 'LinkedIn Stat Card',
    description: 'Single 1200×627 stat/data card for LinkedIn feed.',
    platform: 'linkedin',
    category: 'single',
    dimensions: { width: 1200, height: 627 },
    slides: [
      singleCard('stat', 'split-panel', 'brand-primary', [
        { id: 'stat_number', type: 'stat_number', required: true, maxChars: 12, constraints: ['number + unit only', 'no sentences'], hint: 'The stat. Example: "87%" or "4.2x" or "$2.3M".' },
        { id: 'stat_label', type: 'stat_label', required: true, maxChars: 60, constraints: ['plain English label'], hint: 'What the stat means. Example: "of teams save 4+ hours a week".' },
        { id: 'body', type: 'body', required: false, maxChars: 100, constraints: ['source or context'], hint: 'Source or additional context for the stat.' },
      ]),
    ],
  },
  {
    id: 'linkedin-quote-single',
    name: 'LinkedIn Pull Quote',
    description: 'Single 1200×627 pull quote card for LinkedIn.',
    platform: 'linkedin',
    category: 'single',
    dimensions: { width: 1200, height: 627 },
    slides: [
      singleCard('quote', 'centered', 'dark', [
        { id: 'quote', type: 'quote', required: true, maxChars: 120, constraints: ['no quotation marks — added by renderer', 'impactful', 'original'], hint: 'The pull quote. Attributed to a person or brand voice.' },
        { id: 'attribution', type: 'attribution', required: false, maxChars: 40, constraints: ['Name, Title or Company'], hint: 'Who said it. Example: "Sarah K., CEO of Taskip".' },
      ]),
    ],
  },
  {
    id: 'linkedin-list-carousel',
    name: 'LinkedIn Numbered List',
    description: '7-slide numbered list carousel. Cover → 5 list slides → CTA.',
    platform: 'linkedin',
    category: 'carousel',
    dimensions: { width: 1080, height: 1080 },
    slides: [
      carouselCover(5),
      listContent('List point 1 headline.'),
      listContent('List point 2 headline.'),
      listContent('List point 3 headline.'),
      listContent('List point 4 headline.'),
      listContent('List point 5 headline.'),
      carouselCta(),
    ],
  },

  // ─── Instagram ───────────────────────────────────────────────────────────────
  {
    id: 'instagram-quote',
    name: 'Instagram Quote Card',
    description: 'Single 1080×1080 quote card for Instagram feed.',
    platform: 'instagram',
    category: 'single',
    dimensions: { width: 1080, height: 1080 },
    slides: [
      singleCard('quote', 'centered', 'brand-primary', [
        { id: 'quote', type: 'quote', required: true, maxChars: 100, constraints: ['punchy', 'shareable', 'no jargon'], hint: 'Short, inspiring quote.' },
        { id: 'attribution', type: 'attribution', required: false, maxChars: 30, constraints: [], hint: 'Attribution line.' },
      ]),
    ],
  },
  {
    id: 'instagram-fact',
    name: 'Instagram Fact / Stat Card',
    description: 'Single 1080×1080 stat or fact card for Instagram feed.',
    platform: 'instagram',
    category: 'single',
    dimensions: { width: 1080, height: 1080 },
    slides: [
      singleCard('stat', 'centered', 'dark', [
        { id: 'stat_number', type: 'stat_number', required: true, maxChars: 12, constraints: ['number + unit only'], hint: 'Big stat number.' },
        { id: 'stat_label', type: 'stat_label', required: true, maxChars: 60, constraints: [], hint: 'What it means.' },
        { id: 'body', type: 'body', required: false, maxChars: 80, constraints: [], hint: 'Context or source.' },
      ]),
    ],
  },
  {
    id: 'instagram-carousel-edu',
    name: 'Instagram Edu Carousel',
    description: '6-slide educational carousel for Instagram. Cover → 4 content → CTA.',
    platform: 'instagram',
    category: 'carousel',
    dimensions: { width: 1080, height: 1080 },
    slides: [
      carouselCover(4),
      carouselContent('Key point 1 for this educational series.'),
      carouselContent('Key point 2 for this educational series.'),
      carouselContent('Key point 3 for this educational series.'),
      carouselContent('Key point 4 for this educational series.'),
      carouselCta(),
    ],
  },
  {
    id: 'instagram-story-tip',
    name: 'Instagram Story — Tip',
    description: 'Single 1080×1920 story format with one actionable tip.',
    platform: 'instagram',
    category: 'story',
    dimensions: { width: 1080, height: 1920 },
    slides: [
      singleCard('content', 'centered', 'brand-primary', [
        { id: 'headline', type: 'headline', required: true, maxChars: 50, constraints: ['large display text', 'very punchy'], hint: 'Story tip headline. Will be displayed very large.' },
        { id: 'body', type: 'body', required: false, maxChars: 120, constraints: ['2–3 lines max'], hint: 'Supporting detail for the tip.' },
        { id: 'cta', type: 'cta', required: false, maxChars: 40, constraints: ['short action'], hint: 'Swipe up text or action.' },
      ]),
    ],
  },
  {
    id: 'instagram-story-announce',
    name: 'Instagram Story — Announcement',
    description: 'Single 1080×1920 story for announcements and launches.',
    platform: 'instagram',
    category: 'story',
    dimensions: { width: 1080, height: 1920 },
    slides: [
      singleCard('content', 'centered', 'brand-secondary', [
        { id: 'headline', type: 'headline', required: true, maxChars: 40, constraints: ['announcement style', 'exciting'], hint: 'Announcement headline. Example: "We just launched X".' },
        { id: 'body', type: 'body', required: false, maxChars: 120, constraints: [], hint: 'What this announcement means for the reader.' },
        { id: 'cta', type: 'cta', required: false, maxChars: 40, constraints: [], hint: 'Link in bio or action.' },
      ]),
    ],
  },

  // ─── Twitter / X ─────────────────────────────────────────────────────────────
  {
    id: 'twitter-announcement',
    name: 'Twitter Wide Card',
    description: 'Single 1600×900 announcement card for Twitter/X.',
    platform: 'twitter',
    category: 'single',
    dimensions: { width: 1600, height: 900 },
    slides: [
      singleCard('content', 'left-aligned', 'brand-primary', [
        { id: 'headline', type: 'headline', required: true, maxChars: 60, constraints: ['Twitter voice', 'direct and punchy'], hint: 'Main announcement headline.' },
        { id: 'body', type: 'body', required: false, maxChars: 120, constraints: [], hint: 'Supporting detail or context.' },
      ]),
    ],
  },
  {
    id: 'twitter-thread-card',
    name: 'Twitter Thread Visual',
    description: 'Single 1600×900 visual card to accompany a tweet thread.',
    platform: 'twitter',
    category: 'single',
    dimensions: { width: 1600, height: 900 },
    slides: [
      singleCard('content', 'split-panel', 'dark', [
        { id: 'headline', type: 'headline', required: true, maxChars: 60, constraints: ['thread hook style'], hint: 'Thread hook headline. Example: "The 5 things I learned about X".' },
        { id: 'stat_number', type: 'stat_number', required: false, maxChars: 8, constraints: [], hint: 'Thread count or key number.' },
        { id: 'body', type: 'body', required: false, maxChars: 100, constraints: [], hint: 'Teaser for what is in the thread.' },
      ]),
    ],
  },

  // ─── Facebook ────────────────────────────────────────────────────────────────
  {
    id: 'facebook-ad-banner',
    name: 'Facebook Ad Banner',
    description: 'Single 1200×628 Facebook-optimized ad banner.',
    platform: 'facebook',
    category: 'single',
    dimensions: { width: 1200, height: 628 },
    slides: [
      singleCard('content', 'split-panel', 'brand-primary', [
        { id: 'headline', type: 'headline', required: true, maxChars: 40, constraints: ['Facebook ad headline best practice', 'value proposition first'], hint: 'Ad headline. Lead with the value, not the brand.' },
        { id: 'body', type: 'body', required: false, maxChars: 100, constraints: ['concrete benefit'], hint: 'Supporting copy.' },
        { id: 'cta', type: 'cta', required: false, maxChars: 30, constraints: [], hint: 'Button label. Example: "Try Free" or "Learn More".' },
      ]),
    ],
  },

  // ─── Generic ─────────────────────────────────────────────────────────────────
  {
    id: 'generic-infographic',
    name: '3-Column Infographic',
    description: 'Single 1080×1080 three-column infographic card for any platform.',
    platform: 'linkedin',
    category: 'single',
    dimensions: { width: 1080, height: 1080 },
    slides: [
      {
        role: 'content',
        layout: 'split-panel',
        styleRules: {
          backgroundVariant: 'white',
          backgroundType: 'solid',
          textPrimary: 'dark',
          accentType: 'top-bar',
          showLogo: true,
          showSlideIndicator: false,
          showBrandBar: true,
        },
        slots: [
          { id: 'headline', type: 'headline', required: true, maxChars: 50, constraints: [], hint: 'Infographic title.' },
          { id: 'list_items', type: 'list_items', required: true, maxChars: 240, constraints: ['exactly 3 items', 'each under 60 chars', 'parallel structure', 'each starts with a bold keyword'], hint: '3 columns of content. Format: "Keyword: description".' },
        ],
      },
    ],
  },
  {
    id: 'generic-checklist',
    name: 'Checklist Card',
    description: 'Single 1080×1080 checklist card for any platform.',
    platform: 'linkedin',
    category: 'single',
    dimensions: { width: 1080, height: 1080 },
    slides: [
      {
        role: 'list',
        layout: 'list-layout',
        styleRules: {
          backgroundVariant: 'white',
          backgroundType: 'solid',
          textPrimary: 'dark',
          accentType: 'left-stripe',
          showLogo: true,
          showSlideIndicator: false,
          showBrandBar: true,
        },
        slots: [
          { id: 'headline', type: 'headline', required: true, maxChars: 50, constraints: [], hint: 'Checklist title. Example: "Before You Launch: The 7-Point Checklist".' },
          { id: 'list_items', type: 'list_items', required: true, maxChars: 280, constraints: ['5–7 items', 'each under 40 chars', 'action items'], hint: 'Checklist items. Each will be rendered with a checkbox.' },
        ],
      },
    ],
  },
];

export function getFormat(id: string): PostFormat | undefined {
  return POST_FORMAT_REGISTRY.find(f => f.id === id);
}

export function listFormats(): PostFormat[] {
  return POST_FORMAT_REGISTRY;
}
