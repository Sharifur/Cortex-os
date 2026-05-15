import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Link as LinkIcon, Unlink, Minus, ImageIcon, Loader2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface DraftEditorProps {
  value: string;
  onChange: (text: string) => void;
  token: string;
}

function Btn({
  onClick, active, title, children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`p-1.5 rounded transition-colors ${
        active ? 'bg-primary/25 text-primary' : 'text-slate-300 hover:text-white hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}

export function DraftEditor({ value, onChange, token }: DraftEditorProps) {
  const [uploading, setUploading] = useState(false);
  const initialised = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: '',
    onUpdate({ editor: e }) {
      onChange(e.getText({ blockSeparator: '\n' }));
    },
    editorProps: {
      attributes: {
        class: 'min-h-[180px] max-h-[400px] overflow-y-auto px-4 py-3 text-sm text-slate-100 focus:outline-none leading-relaxed',
      },
    },
  });

  // Set initial content once editor is ready
  useEffect(() => {
    if (!editor || initialised.current) return;
    initialised.current = true;
    if (value) {
      const html = value
        .split('\n')
        .map((line) => `<p>${line || '<br>'}</p>`)
        .join('');
      editor.commands.setContent(html, { emitUpdate: false });
    }
  }, [editor, value]);

  // Handle image paste
  useEffect(() => {
    if (!editor) return;
    const handler = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          const file = item.getAsFile();
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              setUploading(true);
              const base64 = (e.target?.result as string).split(',')[1];
              const res = await fetch('/support/upload-image', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: base64, filename: file.name, mimeType: file.type }),
              });
              const json = await res.json();
              if (json.url) {
                editor.chain().focus().setImage({ src: json.url }).run();
              }
            } catch {
              // ignore upload errors silently
            } finally {
              setUploading(false);
            }
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    };
    const el = editor.view.dom;
    el.addEventListener('paste', handler as EventListener);
    return () => el.removeEventListener('paste', handler as EventListener);
  }, [editor, token]);

  function addLink() {
    if (!editor) return;
    const prev = editor.getAttributes('link').href ?? '';
    const url = window.prompt('URL', prev);
    if (url === null) return;
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden focus-within:ring-1 focus-within:ring-ring">
      {/* Toolbar — always visible */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-card flex-wrap">
        <Btn onClick={() => editor?.chain().focus().toggleBold().run()} active={!!editor?.isActive('bold')} title="Bold">
          <Bold className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor?.chain().focus().toggleItalic().run()} active={!!editor?.isActive('italic')} title="Italic">
          <Italic className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={!!editor?.isActive('underline')} title="Underline">
          <UnderlineIcon className="w-3.5 h-3.5" />
        </Btn>

        <span className="w-px h-4 bg-border mx-0.5" />

        <Btn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={!!editor?.isActive('bulletList')} title="Bullet list">
          <List className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={!!editor?.isActive('orderedList')} title="Numbered list">
          <ListOrdered className="w-3.5 h-3.5" />
        </Btn>

        <span className="w-px h-4 bg-border mx-0.5" />

        <Btn onClick={addLink} active={!!editor?.isActive('link')} title="Add link">
          <LinkIcon className="w-3.5 h-3.5" />
        </Btn>
        {editor?.isActive('link') && (
          <Btn onClick={() => editor.chain().focus().unsetLink().run()} title="Remove link">
            <Unlink className="w-3.5 h-3.5" />
          </Btn>
        )}

        <span className="w-px h-4 bg-border mx-0.5" />

        <Btn onClick={() => editor?.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
          <Minus className="w-3.5 h-3.5" />
        </Btn>

        <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground select-none">
          {uploading
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</>
            : <><ImageIcon className="w-3 h-3" /> Paste image</>
          }
        </span>
      </div>

      {/* Editor area */}
      <div className="bg-background">
        {editor
          ? <EditorContent editor={editor} />
          : <div className="min-h-[180px] px-4 py-3 text-sm text-muted-foreground">Loading editor…</div>
        }
      </div>
    </div>
  );
}
