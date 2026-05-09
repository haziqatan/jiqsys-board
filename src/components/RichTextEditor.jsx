import { useEditor, EditorContent } from '@tiptap/react'
import { useEffect, useRef } from 'react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { handleClipboardImagePaste, readImageAsDataUrl } from '../lib/tiptapImages'
import {
  RichTable,
  RichTableCell,
  RichTableHeader,
  RichTableRow,
  createTableContent,
} from '../lib/tiptapTable'
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
  IconTable,
} from './Icons'
import '../styles/RichTextEditor.css'

export default function RichTextEditor({ value, onChange }) {
  const editorRef = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Image.configure({ allowBase64: true }),
      Link.configure({ openOnClick: false }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      RichTable,
      RichTableRow,
      RichTableHeader,
      RichTableCell,
    ],
    content: value || '<p></p>',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      handlePaste: (_view, event) =>
        handleClipboardImagePaste(event, (src) => {
          editorRef.current?.chain().focus().setImage({ src }).run()
        }),
    },
  })

  useEffect(() => {
    editorRef.current = editor
    return () => {
      if (editorRef.current === editor) editorRef.current = null
    }
  }, [editor])

  if (!editor) return <div className="re-loading">Loading editor…</div>

  const addImage = (url) => {
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }

  const insertTable = () => {
    editor.chain().focus().insertContent(createTableContent()).run()
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
        <ToolbarButton
          active={editor.isActive('table')}
          title="Insert table"
          onClick={insertTable}
        >
          <IconTable />
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
                readImageAsDataUrl(file)
                  .then(addImage)
                  .catch((error) => console.error(error))
                e.target.value = ''
              }
            }}
          />
        </label>
      </div>

      <EditorContent
        editor={editor}
        className="editor-content"
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
