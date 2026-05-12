import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Layers, Upload, RefreshCw, Download, Check, X, ChevronDown, ChevronUp, Sparkles, Image } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const apiHref = (path: string) => `${API_BASE}${path}`;

async function apiFetch(token: string, path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...opts?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

type PageTab = 'renders' | 'samples';

// ─── Format selector ──────────────────────────────────────────────────────────

interface PostFormat {
  id: string;
  name: string;
  description: string;
  platform: string;
  category: string;
  dimensions: { width: number; height: number };
  slideCount: number;
}

// ─── Render row ───────────────────────────────────────────────────────────────

interface PostRender {
  id: string;
  formatId: string;
  brand: string;
  topic: string | null;
  intent: string | null;
  slideUrls: string[];
  status: string;
  createdAt: string;
}

function RenderRow({ render, token, onStatusChange }: { render: PostRender; token: string; onStatusChange: () => void }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor =
    render.status === 'approved' ? 'bg-green-500/10 text-green-600 border-green-500/20' :
    render.status === 'rejected' ? 'bg-muted/60 text-muted-foreground border-border' :
    'bg-amber-500/10 text-amber-600 border-amber-500/20';

  async function approve() {
    await apiFetch(token, `/posts/renders/${render.id}/approve`, { method: 'POST' });
    onStatusChange();
  }

  async function reject() {
    await apiFetch(token, `/posts/renders/${render.id}/reject`, { method: 'POST' });
    onStatusChange();
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Slide thumbnails — first two */}
        <div className="flex gap-1 shrink-0">
          {render.slideUrls.slice(0, 2).map((url, i) => (
            <img key={i} src={url} alt={`slide ${i + 1}`} className="w-10 h-10 object-cover rounded-lg border border-border" />
          ))}
          {render.slideUrls.length > 2 && (
            <div className="w-10 h-10 rounded-lg border border-border bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-medium">
              +{render.slideUrls.length - 2}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{render.formatId}</p>
          <p className="text-xs text-muted-foreground truncate">
            {render.brand}{render.topic ? ` — ${render.topic}` : ''}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {new Date(render.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusColor}`}>
            {render.status}
          </span>

          {render.status === 'draft' && (
            <>
              <button
                onClick={approve}
                title="Approve"
                className="p-1.5 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={reject}
                title="Reject"
                className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          {/* Slide grid */}
          {render.slideUrls.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {render.slideUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" className="shrink-0">
                  <img
                    src={url}
                    alt={`Slide ${i + 1}`}
                    className="h-32 w-32 object-cover rounded-xl border border-border hover:border-primary transition-colors"
                  />
                  <p className="text-[10px] text-muted-foreground text-center mt-1">{i + 1}</p>
                </a>
              ))}
            </div>
          )}

          {/* Export links */}
          <div className="flex flex-wrap gap-2">
            <a
              href={apiHref(`/posts/renders/${render.id}/pptx`)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Download className="w-3 h-3" />
              PPTX (Canva layers)
            </a>
            <a
              href={apiHref(`/posts/renders/${render.id}/canva-csv`)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Download className="w-3 h-3" />
              CSV (Bulk Create)
            </a>
            <a
              href={apiHref(`/posts/renders/${render.id}/text-export`)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Download className="w-3 h-3" />
              Plain text
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Renders tab ──────────────────────────────────────────────────────────────

function RendersTab({ token }: { token: string }) {
  const [formats, setFormats] = useState<PostFormat[]>([]);
  const [renders, setRenders] = useState<PostRender[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ formatId: '', brand: 'taskip', topic: '', intent: '' });

  function load() {
    setLoading(true);
    Promise.all([
      apiFetch(token, '/posts/formats'),
      apiFetch(token, '/posts/renders?limit=50'),
    ]).then(([f, r]) => {
      setFormats(Array.isArray(f) ? f : []);
      setRenders(Array.isArray(r) ? r : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [token]);

  async function generate() {
    if (!form.formatId || !form.brand) { setError('Format and brand are required'); return; }
    setGenerating(true); setError('');
    try {
      const res = await apiFetch(token, '/posts/render', {
        method: 'POST',
        body: JSON.stringify({ formatId: form.formatId, brand: form.brand, topic: form.topic || undefined, intent: form.intent || undefined }),
      });
      setRenders(prev => [res, ...prev]);
      setForm(f => ({ ...f, topic: '', intent: '' }));
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Render failed');
    } finally {
      setGenerating(false);
    }
  }

  const selectedFormat = formats.find(f => f.id === form.formatId);

  return (
    <div className="space-y-5">
      {/* Generate form */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium">Generate new post render</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1.5 block">Template format</label>
            <select
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.formatId}
              onChange={e => setForm(f => ({ ...f, formatId: e.target.value }))}
            >
              <option value="">Select a format...</option>
              {['linkedin', 'instagram', 'twitter', 'facebook'].map(platform => {
                const group = formats.filter(f => f.platform === platform);
                if (!group.length) return null;
                return (
                  <optgroup key={platform} label={platform.charAt(0).toUpperCase() + platform.slice(1)}>
                    {group.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name} — {f.category} {f.slideCount > 1 ? `(${f.slideCount} slides)` : ''} {f.dimensions.width}×{f.dimensions.height}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
              <optgroup label="Generic">
                {formats.filter(f => !['linkedin', 'instagram', 'twitter', 'facebook'].includes(f.platform)).map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} — {f.category} {f.dimensions.width}×{f.dimensions.height}
                  </option>
                ))}
              </optgroup>
            </select>
            {selectedFormat && (
              <p className="text-[10px] text-muted-foreground mt-1">{selectedFormat.description}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Brand</label>
            <input
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="taskip"
              value={form.brand}
              onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Intent</label>
            <select
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.intent}
              onChange={e => setForm(f => ({ ...f, intent: e.target.value }))}
            >
              <option value="">Auto-detect</option>
              {['tips', 'announcement', 'quote', 'stat', 'how to', 'checklist', 'list'].map(i => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1.5 block">Topic</label>
            <input
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder='e.g. "5 ways to save time on client work" or "we just launched Insight analytics"'
              value={form.topic}
              onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') generate(); }}
            />
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            onClick={generate}
            disabled={generating || !form.formatId || !form.brand}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {generating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Generate
              </>
            )}
          </button>
          {generating && <p className="text-xs text-muted-foreground">AI is filling content slots and rendering slides. This takes 15–60s.</p>}
        </div>
      </div>

      {/* Renders list */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{renders.length > 0 ? `${renders.length} render${renders.length !== 1 ? 's' : ''}` : 'No renders yet'}</p>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-muted/40 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!loading && renders.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Layers className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No renders yet. Generate your first post above.</p>
        </div>
      )}

      <div className="space-y-3">
        {renders.map(r => (
          <RenderRow key={r.id} render={r} token={token} onStatusChange={load} />
        ))}
      </div>
    </div>
  );
}

// ─── Design Samples tab ───────────────────────────────────────────────────────

interface DesignSampleResult {
  filename: string;
  dna: {
    layout_type: string;
    slide_type: string;
    platform_fit: string[];
    mood_keywords: string[];
    background_style: string;
    primary_color: string;
    accent_color: string;
  };
  kbEntryId: string;
  storageUrl: string;
}

function DesignSamplesTab({ token }: { token: string }) {
  const [brand, setBrand] = useState('');
  const [samples, setSamples] = useState<{ id: string; title: string; sourceUrl?: string; content: string }[]>([]);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [clustering, setClustering] = useState(false);
  const [uploadLog, setUploadLog] = useState<DesignSampleResult[]>([]);
  const [uploadError, setUploadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  async function loadData(b = brand) {
    setLoading(true);
    const brandQ = b ? `?brand=${encodeURIComponent(b)}` : '';
    const [s, p] = await Promise.all([
      apiFetch(token, `/posts/design-samples${brandQ}`).catch(() => []),
      b ? apiFetch(token, `/posts/design-samples/patterns?brand=${encodeURIComponent(b)}`).catch(() => []) : Promise.resolve([]),
    ]);
    setSamples(Array.isArray(s) ? s : []);
    setPatterns(Array.isArray(p) ? p : []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [brand, token]);

  async function uploadFiles(files: File[]) {
    const images = files.filter(f => f.type.startsWith('image/'));
    if (!images.length) { setUploadError('No image files selected'); return; }
    setUploading(true); setUploadError(''); setUploadLog([]);

    const fd = new FormData();
    images.forEach(f => fd.append('files', f));

    try {
      const res = await fetch(`/posts/design-samples/upload?brand=${brand}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) { setUploadError(`Upload failed: ${res.status}`); return; }
      const data = await res.json();
      setUploadLog(data.results ?? []);
      await loadData();
    } catch (e: unknown) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    uploadFiles(files);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    uploadFiles(files);
  }

  async function cluster() {
    setClustering(true);
    try {
      await apiFetch(token, '/posts/design-samples/cluster', { method: 'POST', body: JSON.stringify({ brand }) });
      await loadData();
    } catch (e: unknown) {
      setUploadError((e as Error).message);
    } finally {
      setClustering(false);
    }
  }

  const designSamples = samples.filter(s => s.title.startsWith('Design Sample'));
  const sampleCount = designSamples.length;
  const canCluster = sampleCount >= 20;

  return (
    <div className="space-y-5">
      {/* Brand + actions bar */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Image className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium">Design sample training</p>
        </div>

        <p className="text-xs text-muted-foreground">
          Upload your best-performing social media designs. GPT-4V extracts the design DNA from each image. After 20+ samples, click <strong>Learn patterns</strong> to cluster them into reusable style rules that apply to every future render for this brand.
        </p>

        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Brand (for upload tagging)</label>
            <input
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring w-36"
              placeholder="taskip"
              value={brand}
              onChange={e => setBrand(e.target.value)}
            />
          </div>

          <div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileInput} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'Analyzing...' : 'Upload samples'}
            </button>
          </div>

          <button
            onClick={cluster}
            disabled={clustering || !canCluster}
            title={!canCluster ? `Need ${20 - sampleCount} more samples to cluster` : undefined}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
          >
            {clustering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {clustering ? 'Clustering...' : 'Learn patterns'}
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          {sampleCount} sample{sampleCount !== 1 ? 's' : ''}{brand ? ` for ${brand}` : ' across all brands'}
          {!canCluster && sampleCount < 20 && brand && ` — upload ${20 - sampleCount} more to enable pattern learning`}
        </p>

        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
      </div>

      {/* Drop zone */}
      <div
        ref={dropRef}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
      >
        <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">Drop design images here or click to browse</p>
        <p className="text-xs text-muted-foreground/60 mt-1">PNG, JPG, WEBP — up to 50 files at once</p>
      </div>

      {/* Upload results */}
      {uploadLog.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-medium">Upload results — {uploadLog.length} analyzed</p>
          </div>
          <div className="divide-y divide-border max-h-64 overflow-y-auto">
            {uploadLog.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{r.filename}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {r.dna.layout_type} · {r.dna.slide_type} · {r.dna.platform_fit.join(', ')} · {r.dna.mood_keywords.slice(0, 3).join(', ')}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <span className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: r.dna.primary_color }} title={`Primary: ${r.dna.primary_color}`} />
                  <span className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: r.dna.accent_color }} title={`Accent: ${r.dna.accent_color}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Learned patterns */}
      {patterns.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-medium">Learned patterns for {brand}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Applied to every render for this brand</p>
          </div>
          <div className="divide-y divide-border">
            {patterns.map((p, i) => (
              <div key={i} className="flex gap-3 px-4 py-3">
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{p}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sample grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">Uploaded samples ({sampleCount})</p>
          <button onClick={() => loadData()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>

        {loading && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {[...Array(12)].map((_, i) => <div key={i} className="aspect-square bg-muted/40 rounded-xl animate-pulse" />)}
          </div>
        )}

        {!loading && sampleCount === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <Image className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No samples for {brand} yet. Upload some design images above.</p>
          </div>
        )}

        {!loading && sampleCount > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {designSamples.map(s => {
              const dnaMatch = s.content.match(/DNA JSON: ({.+})/);
              let dna: { slide_type?: string; platform_fit?: string[] } = {};
              try { if (dnaMatch) dna = JSON.parse(dnaMatch[1]); } catch { /* ignore */ }
              return (
                <div key={s.id} className="group relative aspect-square bg-muted/40 rounded-xl overflow-hidden border border-border hover:border-primary/50 transition-colors">
                  {s.sourceUrl ? (
                    <img src={s.sourceUrl} alt={s.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="w-6 h-6 text-muted-foreground opacity-30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                    {dna.slide_type && <p className="text-[9px] text-white font-medium">{dna.slide_type}</p>}
                    {dna.platform_fit?.length && <p className="text-[9px] text-white/70">{dna.platform_fit.join(', ')}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PostRendersPage() {
  const token = useAuthStore(s => s.token) ?? '';
  const [tab, setTab] = useState<PageTab>('renders');

  const tabs: { key: PageTab; label: string; icon: React.ReactNode }[] = [
    { key: 'renders', label: 'Post Renders', icon: <Layers className="w-3.5 h-3.5" /> },
    { key: 'samples', label: 'Design Samples & Training', icon: <Image className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Layers className="w-4 h-4 text-violet-500" />
          </div>
          <div>
            <h1 className="text-base font-semibold">Post Renders</h1>
            <p className="text-xs text-muted-foreground">Generate social media images · Train on design samples</p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-lg p-1 w-fit">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-3xl mx-auto">
          {tab === 'renders' && <RendersTab token={token} />}
          {tab === 'samples' && <DesignSamplesTab token={token} />}
        </div>
      </div>
    </div>
  );
}
