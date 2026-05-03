import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import {
  IconBold,
  IconItalic,
  IconUnderline,
  IconStrike,
  IconList,
  IconListNumbered,
  IconCheck,
  IconImage,
  IconLink,
} from './Icons'
import '../styles/RichTextEditor.css'

export default function RichTextEditor({ value, onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Image,
      Link.configure({ openOnClick: false }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: value || '<p></p>',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  if (!editor) return <div className="re-loading">Loading editor…</div>

  const addImage = (url) => {
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }

  const handleImagePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.indexOf('image') === 0) {
        const blob = item.getAsFile()
        const reader = new FileReader()
        reader.onload = (ev) => addImage(ev.target.result)
        reader.readAsDataURL(blob)
      }
    }
  }

  const promptLink = () => {
    const previous = editor.getAttributes('link').href
    const url = window.prompt('URL', previous || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="rich-editor">
      <div className="editor-toolbar">
        <ToolbarButton
          active={editor.isActive('bold')}
          title="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <IconBold />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          title="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <IconItalic />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('underline')}
          title="Underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <IconUnderline />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('strike')}
          title="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <IconStrike />
        </ToolbarButton>

        <div className="editor-divider" />

        <ToolbarButton
          active={editor.isActive('bulletList')}
          title="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <IconList />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          title="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <IconListNumbered />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('taskList')}
          title="Task list"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <IconCheck />
        </ToolbarButton>

        <div className="editor-divider" />

        <ToolbarButton
          active={editor.isActive('link')}
          title="Link"
          onClick={promptLink}
        >
          <IconLink />
        </ToolbarButton>
        <label className="btn-tool" title="Insert image">
          <IconImage />
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                const r = new FileReader()
                r.onload = (ev) => addImage(ev.target.result)
                r.readAsDataURL(file)
                e.target.value = ''
              }
            }}
          />
        </label>
      </div>

      <EditorContent
        editor={editor}
        className="editor-content"
        onPaste={handleImagePaste}
      />
    </div>
  )
}

function ToolbarButton({ active, title, onClick, children }) {
  return (
    <button
      type="button"
      className={`btn-tool ${active ? 'active' : ''}`}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
