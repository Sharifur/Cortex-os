import { Injectable, Logger } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import * as crypto from 'crypto';
import * as childProcess from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApprovalFolderService } from '../approval-folder.service';
import { AuditLogService } from '../audit-log.service';
import type { BackendAdapter, Candidate, GenerationTask } from './types';

const RENDER_TIMEOUT_MS = 60_000;

const PILLOW_SCRIPT = `
import sys, json
from PIL import Image, ImageDraw, ImageFont

args = json.loads(sys.argv[1])
w, h = args['width'], args['height']
bg = args.get('bg_color', '#1e1b4b')
fg = args.get('fg_color', '#ffffff')
headline = args.get('headline', '')
subheadline = args.get('subheadline', '')
cta = args.get('cta', '')
out = args['output']

img = Image.new('RGB', (w, h), bg)
draw = ImageDraw.Draw(img)

try:
    font_l = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', max(int(w * 0.055), 24))
    font_m = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', max(int(w * 0.035), 16))
except:
    font_l = ImageFont.load_default()
    font_m = font_l

y = int(h * 0.35)
if headline:
    draw.text((w // 2, y), headline, fill=fg, font=font_l, anchor='mm')
    y += int(h * 0.1)
if subheadline:
    draw.text((w // 2, y), subheadline, fill=fg, font=font_m, anchor='mm')
    y += int(h * 0.08)
if cta:
    draw.text((w // 2, y + int(h * 0.05)), cta, fill='#6366f1', font=font_m, anchor='mm')

img.save(out, 'PNG')
print('ok')
`;

@Injectable()
export class LocalRenderAdapter implements BackendAdapter {
  private readonly logger = new Logger(LocalRenderAdapter.name);

  constructor(
    private readonly folder: ApprovalFolderService,
    private readonly audit: AuditLogService,
  ) {}

  async generate(task: GenerationTask): Promise<Candidate> {
    const t0 = Date.now();
    const candidateId = createId();
    const tmpScript = path.join(os.tmpdir(), `canva_render_${candidateId}.py`);
    const tmpOut = path.join(os.tmpdir(), `canva_render_${candidateId}.png`);

    try {
      const args = {
        width: task.brief.dimensions.width,
        height: task.brief.dimensions.height,
        bg_color: task.brief.brand.palette?.[0] ?? '#1e1b4b',
        fg_color: task.brief.brand.palette?.[4] ?? '#ffffff',
        headline: task.brief.copy?.headline ?? task.brief.subject.slice(0, 50),
        subheadline: task.brief.copy?.subheadline ?? '',
        cta: task.brief.copy?.cta ?? '',
        output: tmpOut,
      };

      await fs.writeFile(tmpScript, PILLOW_SCRIPT);
      await this.runPython(tmpScript, JSON.stringify(args));

      const bytes = await fs.readFile(tmpOut);
      const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');

      const candidate: Candidate = {
        id: candidateId,
        sessionId: task.id,
        backend: 'local',
        tool: 'pillow',
        format: 'png',
        width: args.width,
        height: args.height,
        sizeBytes: bytes.length,
        sha256,
        costUsd: 0,
        rationale: task.rationale,
        iteration: 1,
        status: 'pending',
      };

      const filePath = await this.folder.saveCandidate(task.id, candidate, bytes);
      candidate.filePath = filePath;

      await this.audit.append({
        sessionId: task.id,
        candidateId,
        actor: 'LocalRenderAdapter',
        action: 'local.pillow',
        latencyMs: Date.now() - t0,
        outcome: 'success',
      });

      return candidate;
    } catch (err) {
      await this.audit.append({
        sessionId: task.id,
        candidateId,
        actor: 'LocalRenderAdapter',
        action: 'local.pillow',
        latencyMs: Date.now() - t0,
        outcome: 'error',
        error: (err as Error).message,
      });
      return {
        id: candidateId,
        sessionId: task.id,
        backend: 'local',
        tool: 'pillow',
        format: 'png',
        costUsd: 0,
        rationale: task.rationale,
        iteration: 1,
        status: 'failed',
        error: (err as Error).message,
      };
    } finally {
      await fs.unlink(tmpScript).catch(() => {});
      await fs.unlink(tmpOut).catch(() => {});
    }
  }

  private runPython(scriptPath: string, argsJson: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const python = process.env.PYTHON_BIN ?? 'python3';
      const proc = childProcess.spawn(python, [scriptPath, argsJson], {
        timeout: RENDER_TIMEOUT_MS,
        stdio: 'pipe',
      });

      let stderr = '';
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        if (code === 0) return resolve();
        reject(new Error(`Pillow render exited ${code}: ${stderr.slice(0, 300)}`));
      });

      proc.on('error', reject);
    });
  }
}
