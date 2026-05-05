import { useEditor, EditorContent } from '@tiptap/react'
import { createPortal } from 'react-dom'
import StarterKit from '@tiptap/starter-kit'
import ImageExt from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { TextStyle, FontSize } from '@tiptap/extension-text-style'
import { useEffect, useRef, useState } from 'react'
import {
  IconBold, IconItalic, IconStrike,
  IconList, IconListNumbered, IconCheck,
  IconLink, IconImage, IconClose,
} from './Icons'
import '../styles/ShapeEditor.css'

const FONT_SIZES = ['11', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48']

export default function ShapeEditorInner({
  initialContent,
  onUpdate,
  onClose,
  onColorChange,
  cardColor,
  anchorEl,
}) {
  const colorInputRef = useRef(null)
  const [barPos, setBarPos] = useState({ x: 0, y: 0 })

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      ImageExt,
      Link.configure({ openOnClick: false }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      FontSize,
    ],
    content: initialContent || '<p></p>',
    onUpdate: ({ editor: ed }) => onUpdate(ed.getHTML()),
  })

  // Auto-focus on mount
  useEffect(() => {
    if (!editor) return
    const id = setTimeout(() => editor.commands.focus('end'), 20)
    return () => clearTimeout(id)
  }, [editor])

  // Position the format bar above the anchor element once
  useEffect(() => {
    if (!anchorEl) return
    const rect = anchorEl.getBoundingClientRect()
    setBarPos({ x: rect.left + rect.width / 2, y: rect.top - 12 })
  }, [anchorEl])

  const promptLink = () => {
    if (!editor) return
    const prev = editor.getAttributes('link').href
    const url = window.prompt('URL', prev || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }

  const addImage = (url) => {
    if (url && editor) editor.chain().focus().setImage({ src: url }).run()
  }

  const handleImageFile = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const r = new FileReader()
      r.onload = (ev) => addImage(ev.target.result)
      r.readAsDataURL(file)
      e.target.value = ''
    }
  }

  const curFontSize = editor?.getAttributes('textStyle')?.fontSize?.replace('px', '') ?? ''

  if (!editor) return null

  const bar = (
    <div
      className="shape-format-bar"
      style={{ left: barPos.x, top: barPos.y }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Shape color */}
      <button
        className="sfb-color-btn"
        title="Shape color"
        style={{ '--swatch': cardColor || '#dbeafe' }}
        onClick={() => colorInputRef.current?.click()}
      />
      <input
        ref={colorInputRef}
        type="color"
        value={cardColor || '#dbeafe'}
        style={{ display: 'none' }}
        onChange={(e) => onColorChange(e.target.value)}
      />

      <div className="sfb-divider" />

      {/* Font size */}
      <select
        className="sfb-select"
        title="Font size"
        value={curFontSize}
        onChange={(e) => {
          if (e.target.value) {
            editor.chain().focus().setFontSize(`${e.target.value}px`).run()
          } else {
            editor.chain().focus().unsetFontSize().run()
          }
        }}
      >
        <option value="">–</option>
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <div className="sfb-divider" />

      {/* Bold / Italic / Strike */}
      <FmtBtn
        active={editor.isActive('bold')}
        title="Bold (⌘B)"
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <IconBold width={14} height={14} />
      </FmtBtn>
      <FmtBtn
        active={editor.isActive('italic')}
        title="Italic (⌘I)"
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <IconItalic width={14} height={14} />
      </FmtBtn>
      <FmtBtn
        active={editor.isActive('strike')}
        title="Strikethrough"
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <IconStrike width={14} height={14} />
      </FmtBtn>

      <div className="sfb-divider" />

      {/* Lists */}
      <FmtBtn
        active={editor.isActive('bulletList')}
        title="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <IconList width={14} height={14} />
      </FmtBtn>
      <FmtBtn
        active={editor.isActive('orderedList')}
        title="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <IconListNumbered width={14} height={14} />
      </FmtBtn>
      <FmtBtn
        active={editor.isActive('taskList')}
        title="To-do list"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <IconCheck width={14} height={14} />
      </FmtBtn>

      <div className="sfb-divider" />

      {/* Link */}
      <FmtBtn
        active={editor.isActive('link')}
        title="Link"
        onClick={promptLink}
      >
        <IconLink width={14} height={14} />
      </FmtBtn>

      {/* Image upload */}
      <label className="sfb-btn" title="Insert image">
        <IconImage width={14} height={14} />
        <input
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageFile}
        />
      </label>

      <div className="sfb-divider" />

      {/* Done */}
      <FmtBtn title="Done (Esc)" onClick={onClose}>
        <IconClose width={13} height={13} />
      </FmtBtn>
    </div>
  )

  return (
    <>
      <EditorContent
        editor={editor}
        className="shape-editor-content"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
        }}
        onMouseDown={(e) => e.stopPropagation()}
      />
      {createPortal(bar, document.body)}
    </>
  )
}

function FmtBtn({ active, title, onClick, children }) {
  return (
    <button
      type="button"
      className={`sfb-btn${active ? ' active' : ''}`}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
