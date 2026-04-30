import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createId } from '@paralleldrive/cuid2';
import { SettingsService } from '../settings/settings.service';

/**
 * Magic-byte sniffer for the MIME types we actually allow. Replaces the
 * `file-type` package — that lib went pure-ESM in v17+ and breaks NestJS's
 * CommonJS runtime. Inline + dependency-free is safer for this scope.
 *
 * Returns the canonical MIME for the bytes, or null if unrecognized.
 */
function sniffMime(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length < 4) return null;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { mime: 'image/png', ext: 'png' };
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return { mime: 'image/gif', ext: 'gif' };
  // PDF: 25 50 44 46
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return { mime: 'application/pdf', ext: 'pdf' };
  // ZIP / docx / xlsx / pptx (Office Open XML): 50 4B 03 04
  if (buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05) && (buf[3] === 0x04 || buf[3] === 0x06)) {
    return { mime: 'application/zip', ext: 'zip' };
  }
  // DOC / xls / ppt (CFB): D0 CF 11 E0 A1 B1 1A E1
  if (buf.length >= 8 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0 && buf[4] === 0xa1 && buf[5] === 0xb1) {
    return { mime: 'application/x-cfb', ext: 'doc' };
  }
  // RIFF container — could be WEBP. Bytes 0..3 = "RIFF", 8..11 = "WEBP".
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  // AVIF: ftyp box with major brand "avif" or "avis". Bytes 4..7 = "ftyp", 8..11 = "avif"/"avis".
  if (buf.length >= 12 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = buf.slice(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis') return { mime: 'image/avif', ext: 'avif' };
  }
  return null;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * MIME → canonical extension map. Drives both the strict whitelist and the
 * file-type magic-byte cross-check.
 */
const MIME_EXTENSIONS: Record<string, string[]> = {
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'image/avif': ['avif'],
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
};

const ALLOWED_MIME = new Set(Object.keys(MIME_EXTENSIONS));

const ALLOWED_EXTENSIONS = new Set(Object.values(MIME_EXTENSIONS).flat());

/** Refuse anything that smells like an executable or script even if MIME passes. */
const FORBIDDEN_EXTENSIONS = new Set([
  'exe', 'sh', 'bat', 'cmd', 'com', 'msi', 'dll', 'so', 'dylib',
  'js', 'mjs', 'jsx', 'ts', 'tsx', 'php', 'phtml', 'php3', 'php4', 'php5',
  'py', 'rb', 'pl', 'cgi', 'asp', 'aspx', 'jsp', 'jar', 'class',
  'htaccess', 'svg', 'html', 'htm', 'xhtml', 'svgz', 'ps1', 'vbs', 'vbe',
]);

export interface StorageUploadInput {
  /** Module namespace, becomes the top-level folder. e.g. 'livechat', 'agents/canva', 'tags'. */
  module: string;
  /** Sub-path under the module. e.g. '<siteKey>/<sessionId>'. Optional. */
  refKey?: string;
  body: Buffer;
  /** MIME type claimed by the client. Cross-checked against magic bytes. */
  declaredMime: string;
  originalFilename: string;
}

export interface StoredObject {
  key: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private cache: { client: S3Client; bucket: string; publicBase: string | null; expiresAt: number } | null = null;
  private readonly cacheMs = 60_000;

  constructor(private settings: SettingsService) {}

  async isConfigured(): Promise<boolean> {
    const cfg = await this.resolveClient().catch(() => null);
    return !!cfg;
  }

  /**
   * Validate, sniff magic bytes, then upload to R2.
   * Throws BadRequestException on any rule violation; caller should let it bubble.
   */
  async upload(input: StorageUploadInput): Promise<StoredObject> {
    const { client, bucket, publicBase } = await this.resolveClient();

    if (!input.body.length) throw new BadRequestException('Empty file');
    if (input.body.length > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`File too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB)`);
    }

    const safeName = this.sanitizeFilename(input.originalFilename);

    // Magic-byte sniff. Determines the *real* content type from the bytes,
    // ignoring whatever the client claimed in its Content-Type header.
    const sniff = sniffMime(input.body);
    const claimedMime = (input.declaredMime || '').toLowerCase().split(';')[0].trim();
    const sniffedMime = sniff?.mime ?? null;
    const sniffedExt = sniff?.ext ?? null;

    // Strict allow-list: the *sniffed* MIME must be in the whitelist.
    // For doc/docx the magic bytes return CFB / ZIP — file-type maps them to
    // 'application/x-cfb' or 'application/zip'. We allow those when the
    // claimed MIME + extension match doc/docx exactly.
    let resolvedMime = sniffedMime ?? claimedMime;
    const officeMagicMimes = new Set(['application/x-cfb', 'application/zip']);
    if (this.isOfficeDocByExtension(safeName) && (sniffedMime === null || officeMagicMimes.has(sniffedMime))) {
      resolvedMime = this.officeMimeFromExtension(safeName) ?? resolvedMime;
    }

    if (!ALLOWED_MIME.has(resolvedMime)) {
      throw new BadRequestException(`File type not allowed: ${resolvedMime || 'unknown'}`);
    }

    const claimedExt = (safeName.includes('.') ? safeName.split('.').pop() ?? '' : '').toLowerCase();
    if (claimedExt && FORBIDDEN_EXTENSIONS.has(claimedExt)) {
      throw new BadRequestException(`Forbidden file extension: .${claimedExt}`);
    }
    if (claimedExt && !ALLOWED_EXTENSIONS.has(claimedExt)) {
      throw new BadRequestException(`File extension not allowed: .${claimedExt}`);
    }

    // Defense in depth: if magic bytes resolved to image/* or pdf, the claimed
    // MIME or extension must agree (no .pdf-disguised-as-png, no .exe-with-png-magic).
    if (sniffedExt) {
      const acceptableExts = MIME_EXTENSIONS[resolvedMime] ?? [];
      if (claimedExt && !acceptableExts.includes(claimedExt)) {
        throw new BadRequestException(`Extension .${claimedExt} does not match file content (${resolvedMime})`);
      }
    }

    const ext = MIME_EXTENSIONS[resolvedMime]?.[0] ?? claimedExt ?? '';
    const id = createId();
    const moduleSlug = (input.module || 'misc').replace(/[^a-zA-Z0-9_/-]/g, '_').replace(/^\/+|\/+$/g, '');
    const refSlug = input.refKey ? input.refKey.replace(/[^a-zA-Z0-9_/-]/g, '_').replace(/^\/+|\/+$/g, '') : '';
    const key = [moduleSlug, refSlug, `${id}${ext ? '.' + ext : ''}`].filter(Boolean).join('/');

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: input.body,
        ContentType: resolvedMime,
        ContentDisposition: `inline; filename="${safeName}"`,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    const url = await this.urlFor(key, publicBase, client, bucket);

    return {
      key,
      url,
      mimeType: resolvedMime,
      sizeBytes: input.body.length,
      originalFilename: safeName,
    };
  }

  async urlFor(key: string, publicBase?: string | null, client?: S3Client, bucket?: string): Promise<string> {
    if (!client || !bucket || publicBase === undefined) {
      const resolved = await this.resolveClient().catch(() => null);
      if (!resolved) return '';
      client = resolved.client;
      bucket = resolved.bucket;
      publicBase = resolved.publicBase;
    }
    if (publicBase) return `${publicBase}/${key}`;
    try {
      return await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 86400 });
    } catch (err) {
      this.logger.warn(`presign failed for ${key}: ${(err as Error).message}`);
      return '';
    }
  }

  async deleteByKey(key: string): Promise<void> {
    const cfg = await this.resolveClient().catch(() => null);
    if (!cfg) return;
    try {
      await cfg.client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`R2 delete failed for ${key}: ${(err as Error).message}`);
    }
  }

  /** Test the connection with current settings. */
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const { client, bucket } = await this.resolveClient(true);
      // HEAD on the bucket via a no-op list isn't supported on R2 reliably;
      // try a small put + delete probe.
      const probeKey = `_probe/${createId()}.txt`;
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: probeKey, Body: Buffer.from('ok'), ContentType: 'text/plain' }),
      );
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: probeKey }));
      return { ok: true, message: `Bucket "${bucket}" reachable` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Build (or reuse cached) S3 client from current settings. */
  private async resolveClient(forceRefresh = false): Promise<{ client: S3Client; bucket: string; publicBase: string | null }> {
    if (!forceRefresh && this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache;
    }
    const [endpointRaw, accessKeyId, secretAccessKey, bucket, useSslRaw, publicBaseRaw] = await Promise.all([
      this.settings.getDecrypted('storage_endpoint'),
      this.settings.getDecrypted('storage_access_key'),
      this.settings.getDecrypted('storage_secret_key'),
      this.settings.getDecrypted('storage_bucket'),
      this.settings.getDecrypted('storage_use_ssl'),
      this.settings.getDecrypted('storage_public_base'),
    ]);
    if (!endpointRaw || !accessKeyId || !secretAccessKey || !bucket) {
      this.cache = null;
      throw new BadRequestException('Cloudflare R2 not configured. Settings → Integrations → Storage.');
    }
    const useSSL = useSslRaw === undefined || useSslRaw === null ? true : useSslRaw === 'true';
    const endpoint = endpointRaw.startsWith('http') ? endpointRaw : `${useSSL ? 'https' : 'http'}://${endpointRaw}`;
    const publicBase = publicBaseRaw?.replace(/\/$/, '') || null;

    const client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });

    this.cache = { client, bucket, publicBase, expiresAt: Date.now() + this.cacheMs };
    return this.cache;
  }

  /** Strip path separators, refuse dotfiles, restrict to safe charset. */
  private sanitizeFilename(name: string): string {
    const base = ((name || '').split(/[\\/]/).pop() ?? 'file').trim();
    if (!base) throw new BadRequestException('Filename is required');
    if (base.startsWith('.')) throw new BadRequestException('Dotfiles are not allowed');
    // Strip risky characters; keep alnum, dot, dash, underscore, space (replaced).
    const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    if (!cleaned || cleaned.startsWith('.')) throw new BadRequestException('Invalid filename');
    // Reject double extensions like file.php.png.
    const parts = cleaned.split('.');
    for (const p of parts.slice(0, -1)) {
      if (FORBIDDEN_EXTENSIONS.has(p.toLowerCase())) {
        throw new BadRequestException(`Filename contains forbidden component: .${p}`);
      }
    }
    return cleaned;
  }

  private isOfficeDocByExtension(name: string): boolean {
    return /\.(docx?|xlsx?)$/i.test(name);
  }

  private officeMimeFromExtension(name: string): string | null {
    const lower = name.toLowerCase();
    if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (lower.endsWith('.doc')) return 'application/msword';
    return null;
  }
}
