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
  stored: boolean;
}

@Injectable()
export class SettingsService {
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
        stored: !!row,
      };
    });
  }

  async getDecrypted(key: string): Promise<string | null> {
    const def = SETTING_DEFINITIONS[key];
    if (!def) return null;

    const [row] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, key))
      .limit(1);

    if (!row) return def.defaultValue ?? null;
    return def.isSecret ? decrypt(row.value) : row.value;
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
  }

  async delete(key: string): Promise<void> {
    await db.delete(platformSettings).where(eq(platformSettings.key, key));
  }
}
