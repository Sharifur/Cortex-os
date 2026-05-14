import { useState, useRef } from 'react';
import { Upload, Wand2, Trash2, ChevronRight, ImageIcon, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface Template {
  id: string;
  name: string;
  previewData: string | null;
  parameters: Array<{ key: string; type: string; description: string; example: unknown }>;
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
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DesignStudioPage() {
  const token = useAuthStore((s) => s.token) ?? '';

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selected, setSelected] = useState<Template | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  // Import state
  const [importName, setImportName] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate state
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await apiFetch(token, '/design-studio/templates');
      const data = await res.json() as Template[];
      setTemplates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useState(() => { void loadTemplates(); });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportPreview(URL.createObjectURL(file));
    if (!importName) setImportName(file.name.replace(/\.[^.]+$/, ''));
  };

  const handleImport = async () => {
    if (!importFile || !importName.trim()) return;
    setImporting(true);
    setImportError('');
    try {
      const base64 = await fileToBase64(importFile);
      await apiFetch(token, '/design-studio/templates/import', {
        method: 'POST',
        body: JSON.stringify({ name: importName.trim(), imageBase64: base64, mimeType: importFile.type }),
      });
      setImportFile(null);
      setImportPreview(null);
      setImportName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadTemplates();
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImporting(false);
    }
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
      const blob = await res.blob();
      setGeneratedUrl(URL.createObjectURL(blob));
    } catch (err) {
      setGenerateError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(token, `/design-studio/templates/${id}`, { method: 'DELETE' });
      if (selected?.id === id) { setSelected(null); setGeneratedUrl(null); }
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Design Studio</h1>
          <p className="text-sm text-gray-500 mt-1">Experimental — import a design image, then generate variations via chat</p>
        </div>

        <div className="grid grid-cols-12 gap-6">

          {/* Left: Import + template list */}
          <div className="col-span-4 space-y-4">

            {/* Import card */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h2 className="font-semibold text-gray-800 text-sm">Import Design</h2>

              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-indigo-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {importPreview ? (
                  <img src={importPreview} alt="preview" className="max-h-48 mx-auto rounded object-contain" />
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                    <p className="text-xs text-gray-500">Click to upload design image</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              <input
                type="text"
                placeholder="Template name"
                value={importName}
                onChange={e => setImportName(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              {importError && <p className="text-xs text-red-500">{importError}</p>}

              <button
                onClick={handleImport}
                disabled={!importFile || !importName.trim() || importing}
                className="w-full bg-indigo-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Extracting...</> : <><Upload className="w-4 h-4" /> Import & Extract</>}
              </button>
            </div>

            {/* Template list */}
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              <div className="px-4 py-3 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800 text-sm">Templates</h2>
                {loadingTemplates && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
              </div>
              {templates.length === 0 && !loadingTemplates && (
                <div className="px-4 py-8 text-center text-xs text-gray-400">No templates yet. Import one above.</div>
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
                      onClick={e => { e.stopPropagation(); void handleDelete(t.id); }}
                      className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Right: Generate panel */}
          <div className="col-span-8 space-y-4">

            {!selected ? (
              <div className="bg-white rounded-xl border border-gray-200 h-full flex items-center justify-center py-24">
                <div className="text-center space-y-2">
                  <Wand2 className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="text-sm text-gray-400">Select a template to start generating</p>
                </div>
              </div>
            ) : (
              <>
                {/* Template info */}
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

                {/* Chat input */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <h2 className="font-semibold text-gray-800 text-sm">Generate with chat</h2>
                  <textarea
                    placeholder="Describe what you want to generate, e.g. '5 productivity habits that boost remote team output'"
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
                    {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Wand2 className="w-4 h-4" /> Generate</>}
                  </button>
                </div>

                {/* Comparison: original vs generated */}
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
                          <a
                            href={generatedUrl}
                            download="generated.png"
                            className="block text-center text-xs text-indigo-600 hover:underline"
                          >
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
