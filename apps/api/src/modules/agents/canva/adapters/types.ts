export type BackendType = 'canva' | 'ai_image' | 'local';

export type DesignIntent =
  | 'social_post'
  | 'presentation'
  | 'marketing_banner'
  | 'logo'
  | 'infographic'
  | 'print'
  | 'illustration'
  | 'custom';

export type CandidateStatus = 'pending' | 'approved' | 'rejected' | 'revised' | 'failed';
export type OutputFormat = 'png' | 'pdf' | 'svg' | 'jpg';

export interface DesignBrand {
  name?: string;       // taskip | xgenious
  kitId?: string;      // Canva brand kit ID
  palette?: string[];  // hex colors
  fonts?: string[];
  voiceProfile?: string;
}

export interface DesignBrief {
  intent: DesignIntent;
  subject: string;
  audience?: string;
  tone: string[];
  dimensions: { width: number; height: number; unit: 'px' };
  format: OutputFormat;
  brand: DesignBrand;
  copy?: { headline?: string; subheadline?: string; cta?: string };
  references?: Array<{ type: 'image' | 'url' | 'design_id'; value: string }>;
  constraints?: string[];
  nCandidates: number;
  briefHash?: string;
}

export interface GenerationTask {
  id: string;
  backend: BackendType;
  skill: string;
  brief: DesignBrief;
  variant?: string;   // A | B | C
  rationale: string;
}

export interface GenerationPlan {
  sessionId: string;
  brief: DesignBrief;
  tasks: GenerationTask[];
}

export interface Candidate {
  id: string;
  sessionId: string;
  backend: BackendType;
  tool: string;
  filePath?: string;
  format: OutputFormat;
  width?: number;
  height?: number;
  sizeBytes?: number;
  sha256?: string;
  phash?: string;
  parentCandidateId?: string;
  iteration: number;
  costUsd: number;
  rationale: string;
  canvaDesignId?: string;
  canvaEditUrl?: string;
  thumbnailPath?: string;
  status: CandidateStatus;
  error?: string;
}

export interface ImageRequest {
  prompt: string;
  negativePrompt?: string;
  size: { width: number; height: number };
  n: number;
  style?: 'natural' | 'vivid' | 'illustration' | 'photo-realistic';
  seed?: number;
  referenceImagePath?: string;
}

export interface ImageResult {
  bytes: Buffer;
  provider: string;
  model: string;
  seed?: number;
  costUsd: number;
}

export interface BackendAdapter {
  generate(task: GenerationTask): Promise<Candidate>;
}
