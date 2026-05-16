export interface DmSequenceTemplate {
  name: string;
  goal: string;
  category: string;
  steps: Array<{ stepNumber: number; delayDays: number; instruction: string }>;
}

export const DM_SEQUENCE_CATEGORIES = [
  'Product Outreach',
  'Partnership',
  'Recruitment',
  'Consulting',
  'Content & Creator',
];

export const DM_SEQUENCE_TEMPLATES: DmSequenceTemplate[] = [
  // ─── Product Outreach ───────────────────────────────────────────────────────
  {
    name: 'Taskip — Agency Outreach',
    category: 'Product Outreach',
    goal: 'Promote Taskip to agency owners and freelancers who struggle with client, project, and payment management',
    steps: [
      {
        stepNumber: 1,
        delayDays: 0,
        instruction: `Start a real conversation — ask them one simple, specific question about their work based on their headline. Reference their role or company if visible. No pitch, no mention of any product. Sound like someone genuinely curious about what they do.`,
      },
      {
        stepNumber: 2,
        delayDays: 3,
        instruction: `Follow up naturally from the first message. Ask how they currently manage their clients, projects, and payments day-to-day. Something like asking if they use different tools for each or handle it all in one place. Keep it conversational and focused on understanding their workflow, not selling anything.`,
      },
      {
        stepNumber: 3,
        delayDays: 4,
        instruction: `Based on what they shared, introduce Taskip as a tool built for exactly this — managing clients, projects, and payments in one place. Keep it short and soft. One sentence on what Taskip does, then ask if they'd like to take a quick look. No hard CTA, no "book a demo" language. Frame it as sharing something relevant, not selling.`,
      },
    ],
  },
  {
    name: 'SaaS Tool — Pain-first Intro',
    category: 'Product Outreach',
    goal: 'Introduce a SaaS product by first understanding the prospect\'s pain point before pitching',
    steps: [
      {
        stepNumber: 1,
        delayDays: 0,
        instruction: `Open with a genuine question about a challenge related to their role. Reference something specific in their headline or recent activity if visible. No product mention. Keep it to 2 sentences max.`,
      },
      {
        stepNumber: 2,
        delayDays: 3,
        instruction: `Acknowledge what they shared and dig one level deeper — ask what that problem costs them in time or money, or how they're currently solving it. Show genuine interest in understanding their situation before offering anything.`,
      },
      {
        stepNumber: 3,
        delayDays: 5,
        instruction: `Now briefly connect their pain to what your product does. One clear sentence on the problem it solves. Then offer to share more or let them try it — no pressure. Make it feel like a natural next step, not a sales pitch.`,
      },
    ],
  },
  {
    name: 'Product Launch — Warm Intro',
    category: 'Product Outreach',
    goal: 'Introduce a newly launched product to relevant professionals who would benefit from it',
    steps: [
      {
        stepNumber: 1,
        delayDays: 0,
        instruction: `Start with something specific about their work — a genuine observation or question. Do not mention the product yet. You are just opening a conversation with someone whose work is relevant to what you've built.`,
      },
      {
        stepNumber: 2,
        delayDays: 4,
        instruction: `Mention that you recently launched something and you think it might be relevant to them given what they do. Briefly explain what problem it solves in one sentence. Ask if they'd be open to taking a look — no pressure, just sharing.`,
      },
    ],
  },

  // ─── Partnership ────────────────────────────────────────────────────────────
  {
    name: 'Partnership Exploration',
    category: 'Partnership',
    goal: 'Explore mutual collaboration or referral opportunities with complementary businesses',
    steps: [
      {
        stepNumber: 1,
        delayDays: 0,
        instruction: `Open with a genuine compliment or observation about their work — something specific you noticed in their profile or headline. Ask one question about what they're currently focused on. No agenda yet.`,
      },
      {
        stepNumber: 2,
        delayDays: 4,
        instruction: `Share briefly what you're building and who you serve. Then mention that you work with a similar audience and you've been thinking about whether there's a natural way to collaborate or refer each other. Ask if they'd be open to a quick conversation to explore it.`,
      },
      {
        stepNumber: 3,
        delayDays: 5,
        instruction: `Follow up with one concrete idea for how you could collaborate — a referral arrangement, a joint piece of content, a co-hosted event, or an integration. Keep it specific and easy to respond to. Ask if it sounds interesting.`,
      },
    ],
  },
  {
    name: 'Agency x Freelancer Alliance',
    category: 'Partnership',
    goal: 'Build a referral or subcontracting relationship with freelancers or agencies in complementary niches',
    steps: [
      {
        stepNumber: 1,
        delayDays: 0,
        instruction: `Acknowledge their specialty and ask what kind of projects they're focused on right now. Keep it brief and curious — you're genuinely trying to understand what they do before suggesting anything.`,
      },
      {
        stepNumber: 2,
        delayDays: 3,
        instruction: `Share what you do and who you typically work with. Mention that you sometimes encounter clients who need exactly what they offer, and vice versa. Ask if they'd be open to referring each other when the fit is right.`,
      },
    ],
  },

  // ─── Recruitment ────────────────────────────────────────────────────────────
  {
    name: 'Talent Outreach — Tech Role',
    category: 'Recruitment',
    goal: 'Reach out to developers or technical professionals for a role opening',
    steps: [
      {
        stepNumber: 1,
        delayDays: 0,
        instruction: `Open with genuine interest in their background — reference their tech stack, a project, or their current role. Ask one question about what kind of work excites them most right now. No mention of a job yet.`,
      },
      {
        stepNumber: 2,
        delayDays: 3,
        instruction: `Now mention that you have a role you think could be a strong fit based on their background. Give one sentence on what the company does and what the role involves. Ask if they'd be open to hearing more — low pressure, just planting the seed.`,
      },
      {
        stepNumber: 3,
        delayDays: 4,
        instruction: `Follow up with the key details: what they'd work on, what the team looks like, and one thing that makes this opportunity stand out. Ask if they'd like to jump on a short call or if they'd prefer you send more details in writing.`,
      },
    ],
  },
  {
    name: 'Passive Candidate Nurture',
    category: 'Recruitment',
    goal: 'Build a relationship with high-quality passive candidates over time before bringing up a role',
    steps: [
      {
        stepNumber: 1,
        delayDays: 0,
        instruction: `Connect genuinely — comment on something specific in their profile or recent post. Ask a question about their current role or what they're working toward. No job mention. You are just starting a relationship.`,
      },
      {
        stepNumber: 2,
        delayDays: 7,
        instruction: `Check in on something they mentioned or ask how their work is going. Share something briefly about the type of company or team you're working with. Keep it casual — you're building rapport, not recruiting yet.`,
      },
      {
        stepNumber: 3,
        delayDays: 7,
        instruction: `Now mention that you're working with a team that's looking for someone with their background. Ask if they're open to exploring what's out there or if they'd like to hear more about the opportunity. Keep it completely opt-in.`,
      },
    ],
  },

  // ─── Consulting ─────────────────────────────────────────────────────────────
  {
    name: 'Consulting Lead Gen',
    category: 'Consulting',
    goal: 'Generate consulting or advisory leads by leading with expertise and building trust before offering services',
    steps: [
      {
        stepNumber: 1,
        delayDays: 0,
        instruction: `Open with a specific observation about their industry or the challenge their role typically faces. Ask for their perspective — you're positioning yourself as someone thoughtful, not someone selling.`,
      },
      {
        stepNumber: 2,
        delayDays: 4,
        instruction: `Share a short insight or lesson from your own work that's relevant to what they mentioned. Keep it genuinely useful — a real tip or framework, not a tease. Then ask if this is something they're actively working through.`,
      },
      {
        stepNumber: 3,
        delayDays: 5,
        instruction: `Mention that you help companies in their situation solve exactly this kind of problem. Offer a short, no-obligation call to see if there's a fit. Frame it as useful for them even if you never work together — you'll share your thinking either way.`,
      },
    ],
  },
  {
    name: 'Audit or Review Offer',
    category: 'Consulting',
    goal: 'Offer a free audit or review as a lead magnet to start a consulting relationship',
    steps: [
      {
        stepNumber: 1,
        delayDays: 0,
        instruction: `Ask one specific question about how they currently handle a process relevant to your area of expertise. Show you understand the nuances of their role — don't make it generic.`,
      },
      {
        stepNumber: 2,
        delayDays: 3,
        instruction: `Offer to take a quick look at their setup or process — free, no strings. Explain briefly what you'd look at and what they'd get out of it. Make it feel like a gift, not a sales step. Give them an easy way to say yes.`,
      },
    ],
  },

  // ─── Content & Creator ──────────────────────────────────────────────────────
  {
    name: 'Content Collaboration',
    category: 'Content & Creator',
    goal: 'Collaborate with content creators on guest posts, podcast appearances, or co-created content',
    steps: [
      {
        stepNumber: 1,
        delayDays: 0,
        instruction: `Reference specific content they've created — a post, a podcast episode, or a piece you genuinely found useful. Ask one question that shows you actually engaged with it. No pitch yet.`,
      },
      {
        stepNumber: 2,
        delayDays: 4,
        instruction: `Share briefly what kind of content you produce and who your audience is. Mention that their audience and yours seem to overlap. Ask if they'd be open to collaborating — a guest post swap, a podcast guest slot, or a joint piece. Give one specific idea.`,
      },
    ],
  },
  {
    name: 'Newsletter Cross-Promotion',
    category: 'Content & Creator',
    goal: 'Set up newsletter or audience cross-promotion with aligned creators',
    steps: [
      {
        stepNumber: 1,
        delayDays: 0,
        instruction: `Compliment their newsletter or content specifically — mention something that stood out to you in a recent issue or post. Ask what topics they're planning to cover next. Build genuine rapport first.`,
      },
      {
        stepNumber: 2,
        delayDays: 3,
        instruction: `Share what your newsletter covers and roughly how many subscribers or readers you have. Mention that your audiences seem to complement each other. Ask if they'd be open to a mutual shoutout or a sponsored swap — make it easy to say yes with a concrete structure.`,
      },
    ],
  },
];
