import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export interface SpecElement {
  type: 'div' | 'span' | 'img';
  style?: Record<string, string | number>;
  text?: string;
  src?: string;
  children?: SpecElement[];
}

export interface TemplateParameter {
  key: string;
  type: 'text' | 'color' | 'number' | 'lines';
  description: string;
  example: unknown;
}

export interface DesignSpec {
  width: number;
  height: number;
  root: SpecElement;
}

export const designStudioTemplates = pgTable('design_studio_templates', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  previewData: text('preview_data'),
  parameters: jsonb('parameters').notNull().$type<TemplateParameter[]>().default([]),
  spec: jsonb('spec').notNull().$type<DesignSpec>().default({ width: 1080, height: 1080, root: { type: 'div' } }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
