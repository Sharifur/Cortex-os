import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { canvaBrands } from './schema';
import { createId } from '@paralleldrive/cuid2';

export interface CanvaBrand {
  id: string;
  name: string;
  displayName: string;
  voiceProfile: string;
  palette: string[];
  fonts: string[];
  canvaKitId: string | null;
  platforms: string[];
  logoUrl: string | null;
  active: boolean;
}

@Injectable()
export class CanvaBrandsService {
  constructor(private readonly db: DbService) {}

  async list(): Promise<CanvaBrand[]> {
    const rows = await this.db.db.select().from(canvaBrands).orderBy(canvaBrands.name);
    return rows.map(this.map);
  }

  async getByName(name: string): Promise<CanvaBrand | null> {
    const [row] = await this.db.db.select().from(canvaBrands).where(eq(canvaBrands.name, name));
    return row ? this.map(row) : null;
  }

  async upsert(data: {
    name: string;
    displayName: string;
    voiceProfile?: string;
    palette?: string[];
    fonts?: string[];
    canvaKitId?: string;
    platforms?: string[];
    logoUrl?: string;
    active?: boolean;
  }): Promise<CanvaBrand> {
    const existing = await this.getByName(data.name);
    if (existing) {
      await this.db.db.update(canvaBrands).set({
        displayName: data.displayName,
        voiceProfile: data.voiceProfile ?? existing.voiceProfile,
        palette: (data.palette ?? existing.palette) as any,
        fonts: (data.fonts ?? existing.fonts) as any,
        canvaKitId: data.canvaKitId ?? existing.canvaKitId,
        platforms: (data.platforms ?? existing.platforms) as any,
        logoUrl: data.logoUrl ?? existing.logoUrl,
        active: data.active ?? existing.active,
        updatedAt: new Date(),
      }).where(eq(canvaBrands.name, data.name));
      return (await this.getByName(data.name))!;
    }

    const id = createId();
    await this.db.db.insert(canvaBrands).values({
      id,
      name: data.name,
      displayName: data.displayName,
      voiceProfile: data.voiceProfile ?? '',
      palette: (data.palette ?? []) as any,
      fonts: (data.fonts ?? []) as any,
      canvaKitId: data.canvaKitId ?? null,
      platforms: (data.platforms ?? []) as any,
      logoUrl: data.logoUrl ?? null,
      active: data.active ?? true,
    });
    return (await this.getByName(data.name))!;
  }

  private map(row: typeof canvaBrands.$inferSelect): CanvaBrand {
    return {
      id: row.id,
      name: row.name,
      displayName: row.displayName,
      voiceProfile: row.voiceProfile,
      palette: (row.palette as string[]) ?? [],
      fonts: (row.fonts as string[]) ?? [],
      canvaKitId: row.canvaKitId,
      platforms: (row.platforms as string[]) ?? [],
      logoUrl: row.logoUrl,
      active: row.active,
    };
  }
}
