import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Link as LinkIcon, Unlink, Minus, ImageIcon, Loader2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface DraftEditorProps {
  value: string;
  onChange: (text: string) => void;
  token: string;
}

function ToolbarBtn({
  onClick, active, title, disabled, children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`p-1.5 rounded text-sm transition-colors disabled:opacity-40 ${
        active
          ? 'bg-primary/25 text-primary'
          : 'text-slate-300 hover:text-white hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}

export function DraftEditor({ value, onChange, token }: DraftEditorProps) {
  const [uploadingImage, setUploadingImage] = useState(false);

  const uploadImageFile = useCallback(async (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          setUploadingImage(true);
          const base64 = (e.target?.result as string).split(',')[1];
          const res = await fetch('/support/upload-image', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: base64, filename: file.name, mimeType: file.type }),
          });
          const json = await res.json();
          resolve(json.url ?? null);
        } catch {
          resolve(null);
        } finally {
          setUploadingImage(false);
        }
      };
      reader.readAsDataURL(file);
    });
  }, [token]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: value ? `<p>${value.replace(/\n/g, '</p><p>')}</p>` : '',
    onUpdate({ editor }) {
      onChange(editor.getText({ blockSeparator: '\n' }));
    },
    editorProps: {
      attributes: {
        class: 'min-h-[160px] max-h-[400px] overflow-y-auto px-4 py-3 text-sm text-slate-100 focus:outline-none leading-relaxed',
      },
      handlePaste(view, event) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) return true;
            uploadImageFile(file).then((url) => {
              if (url) {
                view.dispatch(
                  view.state.tr.replaceSelectionWith(
                    view.state.schema.nodes.image.create({ src: url, alt: file.name }),
                  ),
                );
              }
            });
            return true;
          }
        }
        return false;
      },
    },
  });

  // Sync when value changes externally (e.g. clicking Edit on a different draft)
  const prevValue = useCallback(() => value, [value]);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = editor.getText({ blockSeparator: '\n' });
    if (current !== value) {
      editor.commands.setContent(value ? `<p>${value.replace(/\n/g, '</p><p>')}</p>` : '', false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevValue]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href ?? '';
    const url = window.prompt('URL', prev);
    if (url === null) return;
    if (!url) { editor.chain().focus().extendMarkToWordIfUnselected().unsetLink().run(); return; }
    editor.chain().focus().extendMarkToWordIfUnselected().setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-border overflow-hidden focus-within:ring-1 focus-within:ring-ring">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-[hsl(222_47%_16%)] border-b border-border flex-wrap">
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">
          <Bold className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)">
          <Italic className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)">
          <UnderlineIcon className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <span className="w-px h-4 bg-border mx-0.5" />

        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          <List className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <span className="w-px h-4 bg-border mx-0.5" />

        <ToolbarBtn onClick={setLink} active={editor.isActive('link')} title="Add link">
          <LinkIcon className="w-3.5 h-3.5" />
        </ToolbarBtn>
        {editor.isActive('link') && (
          <ToolbarBtn onClick={() => editor.chain().focus().unsetLink().run()} title="Remove link">
            <Unlink className="w-3.5 h-3.5" />
          </ToolbarBtn>
        )}

        <span className="w-px h-4 bg-border mx-0.5" />

        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
          <Minus className="w-3.5 h-3.5" />
        </ToolbarBtn>

        {/* Image paste indicator */}
        {uploadingImage && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> Uploading image…
          </span>
        )}
        {!uploadingImage && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
            <ImageIcon className="w-3 h-3" /> Paste image to upload
          </span>
        )}
      </div>

      {/* ── Editor content ── */}
      <div className="bg-background">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
