import { Injectable } from '@nestjs/common';
import { db } from '../../db/client';
import { platformSettings } from '../../db/schemas/settings.schema';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt, maskSecret } from '../../common/crypto/crypto.util';
import { SETTING_DEFINITIONS } from './settings.definitions';

export interface SettingRow {
  key: string;
  value: string;
  isSecret: boolean;
  label: string;
  description?: string | null;
  group: string;
  provider?: string | null;
  stored: boolean;
  options?: Array<{ value: string; label: string; desc?: string }> | null;
}

const CACHE_TTL_MS = 60_000; // 1 minute

@Injectable()
export class SettingsService {
  private readonly cache = new Map<string, { value: string | null; expiresAt: number }>();

  async getAll(): Promise<SettingRow[]> {
    type Row = typeof platformSettings.$inferSelect;
    const rows: Row[] = await db.select().from(platformSettings);
    const stored = new Map<string, Row>(rows.map((r) => [r.key, r]));

    return Object.entries(SETTING_DEFINITIONS).map(([key, def]) => {
      const row = stored.get(key);
      let value = def.defaultValue ?? '';
      if (row) {
        value = def.isSecret ? maskSecret(decrypt(row.value)) : row.value;
      }
      return {
        key,
        value,
        isSecret: def.isSecret,
        label: def.label,
        description: def.description ?? null,
        group: def.group,
        provider: def.provider ?? null,
        stored: !!row,
        options: def.options ?? null,
      };
    });
  }

  async getDecrypted(key: string): Promise<string | null> {
    const def = SETTING_DEFINITIONS[key];
    if (!def) return null;

    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const [row] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, key))
      .limit(1);

    const value = row ? (def.isSecret ? decrypt(row.value) : row.value) : (def.defaultValue ?? null);
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  async upsert(key: string, rawValue: string): Promise<void> {
    const def = SETTING_DEFINITIONS[key];
    if (!def) throw new Error(`Unknown setting key: ${key}`);

    const storedValue = def.isSecret ? encrypt(rawValue) : rawValue;

    await db
      .insert(platformSettings)
      .values({
        key,
        value: storedValue,
        isSecret: def.isSecret,
        label: def.label,
        description: def.description,
      })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: storedValue, updatedAt: new Date() },
      });

    this.cache.delete(key);
  }

  async delete(key: string): Promise<void> {
    await db.delete(platformSettings).where(eq(platformSettings.key, key));
    this.cache.delete(key);
  }
}
