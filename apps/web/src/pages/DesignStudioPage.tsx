import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Wand2, Trash2, ChevronRight, ImageIcon, Loader2, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { getRealtimeSocket } from '@/lib/realtime';

interface Template {
  id: string;
  name: string;
  previewData: string | null;
  parameters: Array<{ key: string; type: string; description: string; example: unknown }>;
  createdAt: string;
}

interface StudioJob {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  error: string | null;
  templateId: string | null;
  previewData: string | null;
  createdAt: string;
}

async function apiFetch(token: string, path: string, opts: RequestInit = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts.headers },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(data?.error ?? data?.message ?? `Request failed (${res.status})`);
  }
  return res;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function StatusIcon({ status }: { status: StudioJob['status'] }) {
  if (status === 'done') return <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />;
  if (status === 'failed') return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
  if (status === 'processing') return <Loader2 className="w-4 h-4 text-indigo-500 animate-spin flex-shrink-0" />;
  return <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />;
}

function statusLabel(status: StudioJob['status']) {
  if (status === 'done') return 'Extracted';
  if (status === 'failed') return 'Failed';
  if (status === 'processing') return 'Analyzing…';
  return 'Queued';
}

function statusBg(status: StudioJob['status']) {
  if (status === 'done') return 'bg-green-50 border-green-200';
  if (status === 'failed') return 'bg-red-50 border-red-200';
  if (status === 'processing') return 'bg-indigo-50 border-indigo-200';
  return 'bg-gray-50 border-gray-200';
}

export default function DesignStudioPage() {
  const token = useAuthStore((s) => s.token) ?? '';

  const [templates, setTemplates] = useState<Template[]>([]);
  const [jobs, setJobs] = useState<StudioJob[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const [dragOver, setDragOver] = useState(false);
  const [queuing, setQueuing] = useState(false);
  const [queueError, setQueueError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState('5 productivity habits that boost remote team output');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  const hasActive = jobs.some(j => j.status === 'pending' || j.status === 'processing');

  const loadTemplates = useCallback(async () => {
    try {
      const res = await apiFetch(token, '/design-studio/templates');
      setTemplates(await res.json() as Template[]);
    } catch { /* ignore */ }
  }, [token]);

  const loadJobs = useCallback(async () => {
    try {
      const res = await apiFetch(token, '/design-studio/jobs');
      setJobs(await res.json() as StudioJob[]);
    } catch { /* ignore */ }
  }, [token]);

  // Initial load
  useEffect(() => {
    void loadJobs();
    void loadTemplates();
  }, [loadJobs, loadTemplates]);

  // WebSocket: subscribe to design-studio room for live job updates
  useEffect(() => {
    const socket = getRealtimeSocket(token);

    const onConnect = () => socket.emit('design-studio:subscribe');

    const onJobUpdate = (data: { jobId: string; status: string; templateId?: string; error?: string }) => {
      setJobs(prev => prev.map(j =>
        j.id === data.jobId
          ? { ...j, status: data.status as StudioJob['status'], templateId: data.templateId ?? j.templateId, error: data.error ?? j.error }
          : j,
      ));
      if (data.status === 'done') void loadTemplates();
    };

    if (socket.connected) onConnect();
    socket.on('connect', onConnect);
    socket.on('design-studio:job-update', onJobUpdate);

    return () => {
      socket.off('connect', onConnect);
      socket.off('design-studio:job-update', onJobUpdate);
      socket.emit('design-studio:unsubscribe');
    };
  }, [token, loadTemplates]);

  // Polling fallback while jobs are active (survives reconnect gaps)
  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(() => void loadJobs(), 3000);
    return () => clearInterval(id);
  }, [hasActive, loadJobs]);

  const applyFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    void submitFiles(arr);
  };

  const submitFiles = async (files: File[]) => {
    setQueuing(true);
    setQueueError('');
    try {
      const items = await Promise.all(
        files.map(async (f) => ({
          name: f.name.replace(/\.[^.]+$/, ''),
          imageBase64: await fileToBase64(f),
          mimeType: f.type,
        })),
      );
      const res = await apiFetch(token, '/design-studio/import-batch', {
        method: 'POST',
        body: JSON.stringify({ items }),
      });
      const newJobs = await res.json() as StudioJob[];
      setJobs(prev => [...newJobs, ...prev]);
    } catch (err) {
      setQueueError((err as Error).message);
    } finally {
      setQueuing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    applyFiles(e.dataTransfer.files);
  };

  const handleGenerate = async () => {
    if (!selected || !prompt.trim()) return;
    setGenerating(true);
    setGenerateError('');
    setGeneratedUrl(null);
    try {
      const res = await apiFetch(token, `/design-studio/templates/${selected.id}/generate`, {
        method: 'POST',
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      setGeneratedUrl(URL.createObjectURL(await res.blob()));
    } catch (err) {
      setGenerateError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await apiFetch(token, `/design-studio/templates/${id}`, { method: 'DELETE' });
      if (selected?.id === id) { setSelected(null); setGeneratedUrl(null); }
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Design Studio</h1>
          <p className="text-sm text-gray-500 mt-1">Experimental — drop design images to extract templates, then generate variations via chat</p>
        </div>

        <div className="grid grid-cols-12 gap-6">

          {/* Left column */}
          <div className="col-span-4 space-y-4">

            {/* Drop zone */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h2 className="font-semibold text-gray-800 text-sm">Upload Designs</h2>

              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-400'}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                {queuing ? (
                  <div className="space-y-2">
                    <Loader2 className="w-8 h-8 text-indigo-500 mx-auto animate-spin" />
                    <p className="text-xs text-gray-500">Queuing…</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                    <p className="text-xs text-gray-500">Click or drag & drop — multiple images supported</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => { if (e.target.files) applyFiles(e.target.files); }}
              />
              {queueError && <p className="text-xs text-red-500">{queueError}</p>}
            </div>

            {/* Jobs queue */}
            {jobs.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                  <h2 className="font-semibold text-gray-800 text-sm">Analysis Queue</h2>
                  {hasActive && <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />}
                  {!hasActive && (
                    <button onClick={() => void loadJobs()} className="text-gray-400 hover:text-gray-600">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                  {jobs.map(job => (
                    <div key={job.id} className={`flex items-center gap-3 px-4 py-3 border-l-2 ${statusBg(job.status)}`}>
                      {job.previewData
                        ? <img src={job.previewData} alt={job.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                        : <div className="w-10 h-10 rounded bg-gray-100 flex-shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{job.name}</p>
                        <p className="text-xs text-gray-400">{statusLabel(job.status)}</p>
                        {job.error && <p className="text-xs text-red-500 truncate">{job.error}</p>}
                      </div>
                      <StatusIcon status={job.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Template list */}
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              <div className="px-4 py-3">
                <h2 className="font-semibold text-gray-800 text-sm">Templates ({templates.length})</h2>
              </div>
              {templates.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-gray-400">Templates appear here once analysis completes</div>
              )}
              {templates.map(t => (
                <div
                  key={t.id}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${selected?.id === t.id ? 'bg-indigo-50' : ''}`}
                  onClick={() => { setSelected(t); setGeneratedUrl(null); setGenerateError(''); }}
                >
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                    {t.previewData
                      ? <img src={t.previewData} alt={t.name} className="w-full h-full object-cover" />
                      : <ImageIcon className="w-5 h-5 text-gray-400 m-auto mt-3" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.parameters.length} params</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <ChevronRight className={`w-4 h-4 ${selected?.id === t.id ? 'text-indigo-500' : 'text-gray-300'}`} />
                    <button
                      onClick={e => { e.stopPropagation(); void handleDeleteTemplate(t.id); }}
                      className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Right column: Generate */}
          <div className="col-span-8 space-y-4">
            {!selected ? (
              <div className="bg-white rounded-xl border border-gray-200 h-full flex items-center justify-center py-32">
                <div className="text-center space-y-2">
                  <Wand2 className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="text-sm text-gray-400">Select a template to start generating</p>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h2 className="font-semibold text-gray-800 text-sm mb-3">{selected.name}</h2>
                  <div className="flex flex-wrap gap-2">
                    {selected.parameters.map(p => (
                      <span key={p.key} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        {p.key} <span className="text-gray-400">({p.type})</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <h2 className="font-semibold text-gray-800 text-sm">Generate with chat</h2>
                  <textarea
                    placeholder="e.g. '5 productivity habits that boost remote team output'"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                  {generateError && <p className="text-xs text-red-500">{generateError}</p>}
                  <button
                    onClick={handleGenerate}
                    disabled={!prompt.trim() || generating}
                    className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Wand2 className="w-4 h-4" /> Generate</>}
                  </button>
                </div>

                {/* Side-by-side comparison */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs font-medium text-gray-500">Original</p>
                    </div>
                    <div className="p-3">
                      {selected.previewData
                        ? <img src={selected.previewData} alt="original" className="w-full rounded object-contain max-h-96" />
                        : <div className="h-48 flex items-center justify-center text-gray-300 text-xs">No preview</div>
                      }
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs font-medium text-gray-500">Generated</p>
                    </div>
                    <div className="p-3">
                      {generating ? (
                        <div className="h-48 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                        </div>
                      ) : generatedUrl ? (
                        <div className="space-y-2">
                          <img src={generatedUrl} alt="generated" className="w-full rounded object-contain max-h-96" />
                          <a href={generatedUrl} download="generated.png" className="block text-center text-xs text-indigo-600 hover:underline">
                            Download PNG
                          </a>
                        </div>
                      ) : (
                        <div className="h-48 flex items-center justify-center text-gray-300 text-xs">
                          Generated image will appear here
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
