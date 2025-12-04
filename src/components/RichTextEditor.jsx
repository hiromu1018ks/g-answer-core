import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Quote, Undo, Redo } from 'lucide-react';

const MenuBar = ({ editor }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 p-2 border-b border-slate-200 bg-slate-50 rounded-t-lg">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${editor.isActive('bold') ? 'bg-slate-200 text-indigo-600' : 'text-slate-600'}`}
        title="太字"
      >
        <Bold size={18} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${editor.isActive('italic') ? 'bg-slate-200 text-indigo-600' : 'text-slate-600'}`}
        title="斜体"
      >
        <Italic size={18} />
      </button>
      <div className="w-px h-6 bg-slate-300 mx-1 self-center" />
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-slate-200 text-indigo-600' : 'text-slate-600'}`}
        title="見出し1"
      >
        <Heading1 size={18} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-slate-200 text-indigo-600' : 'text-slate-600'}`}
        title="見出し2"
      >
        <Heading2 size={18} />
      </button>
      <div className="w-px h-6 bg-slate-300 mx-1 self-center" />
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${editor.isActive('bulletList') ? 'bg-slate-200 text-indigo-600' : 'text-slate-600'}`}
        title="箇条書き"
      >
        <List size={18} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${editor.isActive('orderedList') ? 'bg-slate-200 text-indigo-600' : 'text-slate-600'}`}
        title="番号付きリスト"
      >
        <ListOrdered size={18} />
      </button>
      <div className="w-px h-6 bg-slate-300 mx-1 self-center" />
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${editor.isActive('blockquote') ? 'bg-slate-200 text-indigo-600' : 'text-slate-600'}`}
        title="引用"
      >
        <Quote size={18} />
      </button>
      <div className="flex-1" />
      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        className="p-1.5 rounded hover:bg-slate-200 transition-colors text-slate-600 disabled:opacity-30"
        title="元に戻す"
      >
        <Undo size={18} />
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        className="p-1.5 rounded hover:bg-slate-200 transition-colors text-slate-600 disabled:opacity-30"
        title="やり直し"
      >
        <Redo size={18} />
      </button>
    </div>
  );
};

const RichTextEditor = ({ content, onChange, placeholder = 'ここに答弁案を作成します...' }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none min-h-[300px] h-auto p-4',
      },
    },
  });

  // Update content if it changes externally (e.g. from AI generation)
  React.useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      // Only update if the content is different to avoid cursor jumping
      // This is a simple check; for production might need more robust diffing
      // or only update when content is completely replaced (like new generation)

      // For this use case, we assume external updates are mostly "replacements" or "initial loads"
      // If the user is typing, onChange handles it.
      // If AI generates, we want to replace.

      // To avoid loop when typing: check if the content prop is significantly different
      // or if the editor is empty.
      // A common pattern is to only set content if the editor is not focused, 
      // but here we might want to overwrite when AI generates.

      // Let's assume the parent controls when to update 'content' prop significantly.
      if (editor.getText() === '' && content) {
        editor.commands.setContent(content);
      } else if (content && content !== editor.getHTML() && !editor.isFocused) {
        editor.commands.setContent(content);
      }
    }
  }, [content, editor]);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
