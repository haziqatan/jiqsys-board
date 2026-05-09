import { useEditor, EditorContent } from '@tiptap/react'
import { createPortal } from 'react-dom'
import StarterKit from '@tiptap/starter-kit'
import ImageExt from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { TextStyle, FontSize } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import { useEffect, useRef, useState } from 'react'
import { handleClipboardImagePaste, readImageAsDataUrl } from '../lib/tiptapImages'
import {
  IconBold, IconItalic, IconStrike,
  IconList, IconListNumbered, IconCheck,
  IconLink, IconImage, IconClose,
  IconAlignLeft, IconAlignCenter, IconAlignRight,
  IconTextColor,
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
  // For text-nodes (no shape background) the shape-color picker has
  // nothing to colour, so pass `hideShapeColor` to remove it from the
  // toolbar. The rest of the format bar (font size, text colour, B/I/U,
  // alignment, lists, link, image) stays.
  hideShapeColor = false,
}) {
  const colorInputRef    = useRef(null)
  const textColorInputRef = useRef(null)
  const barRef           = useRef(null)
  const editorWrapRef    = useRef(null)
  const editorRef        = useRef(null)
  const [barPos, setBarPos] = useState({ x: 0, y: 0 })

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      ImageExt.configure({ allowBase64: true }),
      Link.configure({ openOnClick: false }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      FontSize,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: initialContent || '<p></p>',
    onUpdate: ({ editor: ed }) => onUpdate(ed.getHTML()),
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

  // Auto-focus on mount
  useEffect(() => {
    if (!editor) return
    const id = setTimeout(() => editor.commands.focus('end'), 20)
    return () => clearTimeout(id)
  }, [editor])

  // ── Track bar position with rAF so it follows the shape during pan/zoom ──
  useEffect(() => {
    if (!anchorEl) return
    let rafId
    const update = () => {
      const rect = anchorEl.getBoundingClientRect()
      setBarPos({ x: rect.left + rect.width / 2, y: rect.top })
      rafId = requestAnimationFrame(update)
    }
    rafId = requestAnimationFrame(update)
    return () => cancelAnimationFrame(rafId)
  }, [anchorEl])

  // ── Close when pointer-down happens outside editor + bar ──
  useEffect(() => {
    if (!editor) return
    const onPointerDown = (e) => {
      if (editorWrapRef.current?.contains(e.target)) return
      if (barRef.current?.contains(e.target)) return
      if (anchorEl?.contains(e.target)) return
      onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [editor, anchorEl, onClose])

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
      readImageAsDataUrl(file)
        .then(addImage)
        .catch((error) => console.error(error))
      e.target.value = ''
    }
  }

  const curFontSize  = editor?.getAttributes('textStyle')?.fontSize?.replace('px', '') ?? ''
  const curTextColor = editor?.getAttributes('textStyle')?.color ?? '#000000'

  if (!editor) return null

  const bar = (
    <div
      ref={barRef}
      className="shape-format-bar"
      style={{ left: barPos.x, top: barPos.y }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Shape fill color (text-nodes have no fill so we hide it) */}
      {!hideShapeColor && (
        <>
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
        </>
      )}

      {/* Font size */}
      <select
        className="sfb-select"
        title="Font size"
        value={curFontSize}
        // The format-bar wrapper preventDefaults every mousedown so buttons
        // can be clicked without the editor losing focus. That same trick
        // however suppresses the native open-dropdown behaviour of <select>
        // — so we stop the event from reaching the wrapper.
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const v = e.target.value
          // Run inside requestAnimationFrame so the browser has a tick to
          // close the native dropdown before we steal focus back to the
          // editor — without it some browsers swallow the next click.
          requestAnimationFrame(() => {
            if (v) {
              editor.chain().focus().setFontSize(`${v}px`).run()
            } else {
              editor.chain().focus().unsetFontSize().run()
            }
          })
        }}
      >
        <option value="">–</option>
        {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      {/* Text (foreground) color */}
      <button
        className="sfb-text-color-btn"
        title="Text color"
        style={{ '--tc': curTextColor }}
        onClick={() => textColorInputRef.current?.click()}
      >
        <IconTextColor width={14} height={14} />
      </button>
      <input
        ref={textColorInputRef}
        type="color"
        value={curTextColor}
        style={{ display: 'none' }}
        onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
      />

      <div className="sfb-divider" />

      {/* Text alignment */}
      <FmtBtn
        active={editor.isActive({ textAlign: 'left' })}
        title="Align left"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      >
        <IconAlignLeft width={14} height={14} />
      </FmtBtn>
      <FmtBtn
        active={editor.isActive({ textAlign: 'center' })}
        title="Align center"
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      >
        <IconAlignCenter width={14} height={14} />
      </FmtBtn>
      <FmtBtn
        active={editor.isActive({ textAlign: 'right' })}
        title="Align right"
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      >
        <IconAlignRight width={14} height={14} />
      </FmtBtn>

      <div className="sfb-divider" />

      {/* Bold / Italic / Strike */}
      <FmtBtn active={editor.isActive('bold')}   title="Bold (⌘B)"      onClick={() => editor.chain().focus().toggleBold().run()}>
        <IconBold   width={14} height={14} />
      </FmtBtn>
      <FmtBtn active={editor.isActive('italic')} title="Italic (⌘I)"    onClick={() => editor.chain().focus().toggleItalic().run()}>
        <IconItalic width={14} height={14} />
      </FmtBtn>
      <FmtBtn active={editor.isActive('strike')} title="Strikethrough"  onClick={() => editor.chain().focus().toggleStrike().run()}>
        <IconStrike width={14} height={14} />
      </FmtBtn>

      <div className="sfb-divider" />

      {/* Lists */}
      <FmtBtn active={editor.isActive('bulletList')}  title="Bullet list"    onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <IconList          width={14} height={14} />
      </FmtBtn>
      <FmtBtn active={editor.isActive('orderedList')} title="Numbered list"  onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <IconListNumbered  width={14} height={14} />
      </FmtBtn>
      <FmtBtn active={editor.isActive('taskList')}    title="To-do list"     onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <IconCheck         width={14} height={14} />
      </FmtBtn>

      <div className="sfb-divider" />

      {/* Link */}
      <FmtBtn active={editor.isActive('link')} title="Link" onClick={promptLink}>
        <IconLink width={14} height={14} />
      </FmtBtn>

      {/* Image upload */}
      <label className="sfb-btn" title="Insert image">
        <IconImage width={14} height={14} />
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
      </label>

      <div className="sfb-divider" />

      {/* Done */}
      <FmtBtn title="Done (Esc)" onClick={onClose}>
        <IconClose width={13} height={13} />
      </FmtBtn>
    </div>
  )

  // Expose card height as a CSS custom property so ProseMirror's max-height
  // calc() resolves to a real pixel value (percentage max-height on flex
  // children is unreliable across browsers).
  const shapeH = anchorEl ? anchorEl.offsetHeight : 0

  return (
    <>
      <div ref={editorWrapRef} style={{ position: 'absolute', inset: 0, display: 'contents' }}>
        <EditorContent
          editor={editor}
          className="shape-editor-content"
          style={shapeH ? { '--shape-editor-h': `${shapeH}px` } : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.stopPropagation(); onClose() }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onWheel={(e) => {
            // Prevent the canvas from intercepting scroll events while the
            // user is scrolling inside the editor.
            e.stopPropagation()
          }}
        />
      </div>
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
