import React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import '../styles/RichTextEditor.css'

const RichTextEditor = ({ value, onChange }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Image,
      Link.configure({
        openOnClick: false,
      }),
      Underline,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: value || '<p></p>',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  if (!editor) {
    return <div>Loading editor...</div>
  }

  const addImage = (url) => {
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  const handleImagePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let item of items) {
      if (item.type.indexOf('image') === 0) {
        const blob = item.getAsFile()
        const reader = new FileReader()
        reader.onload = (event) => {
          addImage(event.target.result)
        }
        reader.readAsDataURL(blob)
      }
    }
  }

  return (
    <div className="rich-editor">
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`btn-tool ${editor.isActive('bold') ? 'active' : ''}`}
            title="Bold"
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`btn-tool ${editor.isActive('italic') ? 'active' : ''}`}
            title="Italic"
          >
            <em>I</em>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`btn-tool ${editor.isActive('underline') ? 'active' : ''}`}
            title="Underline"
          >
            <u>U</u>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`btn-tool ${editor.isActive('strike') ? 'active' : ''}`}
            title="Strikethrough"
          >
            <s>S</s>
          </button>
        </div>

        <div className="toolbar-group">
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`btn-tool ${editor.isActive('bulletList') ? 'active' : ''}`}
            title="Bullet List"
          >
            •
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`btn-tool ${editor.isActive('orderedList') ? 'active' : ''}`}
            title="Numbered List"
          >
            1.
          </button>
        </div>

        <div className="toolbar-group">
          <button
            onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
            disabled={!editor.can().sinkListItem('listItem')}
            className="btn-tool"
            title="Indent"
          >
            →
          </button>
          <button
            onClick={() => editor.chain().focus().liftListItem('listItem').run()}
            disabled={!editor.can().liftListItem('listItem')}
            className="btn-tool"
            title="Outdent"
          >
            ←
          </button>
        </div>

        <div className="toolbar-group">
          <button
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={`btn-tool ${editor.isActive('taskList') ? 'active' : ''}`}
            title="Checklist"
          >
            ☑
          </button>
        </div>

        <div className="toolbar-group">
          <input
            type="file"
            id="image-input"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                const reader = new FileReader()
                reader.onload = (event) => {
                  addImage(event.target.result)
                }
                reader.readAsDataURL(file)
              }
            }}
          />
          <button
            onClick={() => document.getElementById('image-input').click()}
            className="btn-tool"
            title="Insert Image"
          >
            🖼
          </button>
        </div>
      </div>

      <EditorContent
        editor={editor}
        className="editor-content"
        onPaste={handleImagePaste}
      />
    </div>
  )
}

export default RichTextEditor
