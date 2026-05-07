import { useEffect, useRef, useState } from 'react'
import { getStatusColor } from '../lib/status'
import { getOptionColor } from '../lib/options'
import ShapeEditorInner from './ShapeEditorInner'
import TableNode from './TableNode'
import '../styles/CardNode.css'

const SHAPE_CLIP = {
  diamond:       'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  hexagon:       'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
  parallelogram: 'polygon(12% 0%, 100% 0%, 88% 100%, 0% 100%)',
  triangle:      'polygon(50% 4%, 100% 96%, 0% 96%)',
  star:          'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  arrow:         'polygon(0% 30%, 65% 30%, 65% 5%, 100% 50%, 65% 95%, 65% 70%, 0% 70%)',
}

// Extra vertical padding around textarea inside each shape (compensates for clip whitespace)
const SHAPE_PAD = {
  rectangle: 24, square: 24, circle: 36,
  diamond: 70, hexagon: 50, parallelogram: 28,
  triangle: 60, star: 70, arrow: 40,
}

const MIN_SIZE = {
  rect:          { w: 140, h: 60  },
  text:          { w: 80,  h: 28  },
  image:         { w: 80,  h: 60  },
  rectangle:     { w: 120, h: 70  },
  square:        { w: 100, h: 100 },
  circle:        { w: 80,  h: 80  },
  diamond:       { w: 110, h: 110 },
  hexagon:       { w: 130, h: 110 },
  parallelogram: { w: 150, h: 72  },
  triangle:      { w: 130, h: 110 },
  star:          { w: 130, h: 130 },
  arrow:         { w: 160, h: 80  },
  table:         { w: 200, h: 100 },
}

const TABLE_ROW_H = 34
const TABLE_HEADER_H = 36
const TABLE_FOOTER_H = 30  // height taken by the "+ Add row" footer

export default function CardNode({
  card,
  selected,
  hovered,
  linkTarget,
  searchPulse,
  ghost,            // render translucent preview, no handles/edit
  onMouseDown,
  onDoubleClick,
  onMouseEnter,
  onMouseLeave,
  onStartLink,
  onHoverLinkHandle, // (side|null) → suggest a ghost on this side
  onResize,
  onTitleChange,
  onDescriptionChange,
  onColorChange,
  statusOptions,
  assigneeOptions,
  tagOptions,
}) {
  const nodeShape = card.node_shape || 'rect'
  const [editingTitle, setEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState(card.title)
  const [editH, setEditH] = useState(null)
  const titleRef = useRef(null)
  const nodeRef = useRef(null)
  const [resizing, setResizing] = useState(null)

  useEffect(() => {
    if (!editingTitle) { setDraftTitle(card.title); setEditH(null) }
  }, [card.title, editingTitle])

  useEffect(() => {
    if (!editingTitle || !titleRef.current) return
    const el = titleRef.current
    el.focus()
    if (el.select) el.select()
    // For shape textarea: measure initial needed height
    if (nodeShape !== 'rect' && el.tagName === 'TEXTAREA') {
      el.style.height = '0px'
      const pad = SHAPE_PAD[nodeShape] ?? 36
      const min = MIN_SIZE[nodeShape] || MIN_SIZE.rect
      const needed = Math.max(min.h, el.scrollHeight + pad)
      if (needed > card.height) setEditH(needed)
    }
  }, [editingTitle])

  // Resize drag handler
  useEffect(() => {
    if (!resizing) return
    const shape = resizing.shape
    const onMove = (e) => {
      const dx = (e.clientX - resizing.startX) / resizing.zoom
      const dy = (e.clientY - resizing.startY) / resizing.zoom
      const min = MIN_SIZE[shape] || MIN_SIZE.rect
      let w = Math.max(min.w, resizing.startW + dx)
      let h = Math.max(min.h, resizing.startH + dy)
      onResize(w, h)
    }
    const onUp = () => setResizing(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [resizing, onResize])

  const startResize = (e) => {
    e.stopPropagation()
    e.preventDefault()
    const world = e.currentTarget.closest('.canvas-world')
    const matrix = window.getComputedStyle(world).transform
    let zoom = 1
    if (matrix && matrix !== 'none') {
      const m = matrix.match(/matrix\(([^,]+),/)
      if (m) zoom = parseFloat(m[1])
    }
    setResizing({
      startX: e.clientX, startY: e.clientY,
      startW: card.width, startH: card.height,
      zoom, shape: nodeShape,
    })
  }

  const commitTitle = () => {
    setEditingTitle(false)
    if (editH !== null) {
      const min = MIN_SIZE[nodeShape] || MIN_SIZE.rect
      const newH = Math.max(min.h, editH)
      const newW = card.width
      onResize(newW, newH)
      setEditH(null)
    }
    if (draftTitle !== card.title) onTitleChange(draftTitle)
  }

  const showHandles = selected || hovered || linkTarget
  const displayH = editH ?? card.height
  const displayW = card.width

  // Shared: link handles on all four sides
  const handles = !ghost && showHandles && (
    <>
      <div
        className="link-handle top"
        onMouseDown={(e) => onStartLink(e, 'top')}
        onMouseEnter={() => onHoverLinkHandle?.('top')}
        onMouseLeave={() => onHoverLinkHandle?.(null)}
      />
      <div
        className="link-handle right"
        onMouseDown={(e) => onStartLink(e, 'right')}
        onMouseEnter={() => onHoverLinkHandle?.('right')}
        onMouseLeave={() => onHoverLinkHandle?.(null)}
      />
      <div
        className="link-handle bottom"
        onMouseDown={(e) => onStartLink(e, 'bottom')}
        onMouseEnter={() => onHoverLinkHandle?.('bottom')}
        onMouseLeave={() => onHoverLinkHandle?.(null)}
      />
      <div
        className="link-handle left"
        onMouseDown={(e) => onStartLink(e, 'left')}
        onMouseEnter={() => onHoverLinkHandle?.('left')}
        onMouseLeave={() => onHoverLinkHandle?.(null)}
      />
    </>
  )

  // Shared: resize grip at bottom-right
  const resizeHandle = !ghost && selected && (
    <div className="resize-handle" onMouseDown={startResize}>
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <path d="M1 7L7 1" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M4.5 7L7 4.5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
  )

  // ── TABLE NODE ───────────────────────────────────────────────────────
  if (nodeShape === 'table') {
    return (
      <div
        className={`card-node table-node${selected ? ' selected' : ''}${linkTarget ? ' link-target' : ''}${searchPulse ? ' search-pulse' : ''}${ghost ? ' ghost-node' : ''}`}
        style={{ left: card.x, top: card.y, width: card.width, height: card.height }}
        onMouseDown={onMouseDown}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <TableNode
          card={card}
          onDescriptionChange={onDescriptionChange}
          onResize={onResize}
        />
        {handles}
        {resizeHandle}
      </div>
    )
  }

  if (nodeShape === 'image') {
    const image = card.description?.image
    return (
      <div
        className={`card-node image-node${selected ? ' selected' : ''}${linkTarget ? ' link-target' : ''}${searchPulse ? ' search-pulse' : ''}${ghost ? ' ghost-node' : ''}`}
        style={{ left: card.x, top: card.y, width: displayW, height: displayH }}
        onMouseDown={(e) => { if (editingTitle) return; onMouseDown(e) }}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {image?.src ? (
          <img src={image.src} alt={card.title || image.name || 'Pasted image'} draggable={false} />
        ) : (
          <div className="image-node-empty">Image</div>
        )}
        {handles}
        {resizeHandle}
      </div>
    )
  }

  // ── TEXT NODE — plain text on canvas, no bg ─────────────────────────
  if (nodeShape === 'text') {
    const handleInput = (e) => {
      const ta = e.target
      // Measure natural content height by briefly setting height to "auto"
      // (NOT 0 — at 0 the typed character is clipped behind overflow:hidden
      // for the frame between mutation and React's re-render).
      const prev = ta.style.height
      ta.style.height = 'auto'
      const measured = ta.scrollHeight
      ta.style.height = prev
      const min = MIN_SIZE.text
      setEditH(Math.max(min.h, measured + 8))
      setDraftTitle(ta.value)
    }
    const taHeight = Math.max(20, displayH - 8)
    return (
      <div
        className={`card-node text-node${selected ? ' selected' : ''}${linkTarget ? ' link-target' : ''}${searchPulse ? ' search-pulse' : ''}${ghost ? ' ghost-node' : ''}`}
        style={{ left: card.x, top: card.y, width: displayW, height: displayH }}
        onMouseDown={(e) => { if (editingTitle) return; onMouseDown(e) }}
        onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true) }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {editingTitle ? (
          <textarea
            ref={titleRef}
            className="text-node-edit"
            value={draftTitle}
            style={{ height: taHeight }}
            onChange={handleInput}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitTitle() }
              if (e.key === 'Escape') { setDraftTitle(card.title); setEditingTitle(false) }
            }}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="text-node-label"
            onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true) }}
          >
            {card.title || 'Text'}
          </div>
        )}
        {handles}
        {resizeHandle}
      </div>
    )
  }

  // ── SHAPE NODE (non-rect) ────────────────────────────────────────────
  if (nodeShape !== 'rect') {
    const clipPath = SHAPE_CLIP[nodeShape]
    const usesBorderRadius =
      nodeShape === 'circle' || nodeShape === 'rectangle' || nodeShape === 'square'
    const borderRadius =
      nodeShape === 'circle' ? '50%' :
      (nodeShape === 'rectangle' || nodeShape === 'square') ? 'var(--radius)' : 0

    // Initial TipTap content: prefer saved HTML, fall back to plain title
    const richContent = card.description?.html
    const initialContent = richContent || (card.title ? `<p>${card.title}</p>` : '')

    const closeShapeEdit = () => setEditingTitle(false)

    return (
      <div
        ref={nodeRef}
        className={`card-node shape-node shape-${nodeShape}${selected ? ' selected' : ''}${linkTarget ? ' link-target' : ''}${searchPulse ? ' search-pulse' : ''}${ghost ? ' ghost-node' : ''}`}
        style={{ left: card.x, top: card.y, width: displayW, height: displayH }}
        onMouseDown={(e) => { if (editingTitle) return; onMouseDown(e) }}
        onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true) }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* Clipped colored background */}
        <div
          className="shape-bg"
          style={{
            background: card.color || 'var(--accent-soft)',
            ...(usesBorderRadius ? { borderRadius } : { clipPath }),
          }}
        />

        {/* Rich text editing layer */}
        {editingTitle ? (
          <ShapeEditorInner
            initialContent={initialContent}
            onUpdate={(html) => onDescriptionChange({ html })}
            onClose={closeShapeEdit}
            onColorChange={onColorChange}
            cardColor={card.color}
            anchorEl={nodeRef.current}
          />
        ) : richContent ? (
          <div
            className="shape-label-rich"
            dangerouslySetInnerHTML={{ __html: richContent }}
            onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true) }}
          />
        ) : (
          <div
            className="shape-label"
            onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true) }}
          >
            {card.title || ''}
          </div>
        )}

        {handles}
        {resizeHandle}
      </div>
    )
  }

  // ── RECT CARD ────────────────────────────────────────────────────────
  const statusDot = card.status ? getStatusColor(card.status, statusOptions) : null
  const assigneeDot = card.assignee ? getOptionColor(card.assignee, assigneeOptions) : null
  const tagDot = card.tags?.[0] ? getOptionColor(card.tags[0], tagOptions) : null

  return (
    <div
      className={`card-node shape-rect${selected ? ' selected' : ''}${linkTarget ? ' link-target' : ''}${searchPulse ? ' search-pulse' : ''}${ghost ? ' ghost-node' : ''}`}
      style={{ left: card.x, top: card.y, width: card.width, height: card.height }}
      onMouseDown={(e) => { if (editingTitle) return; onMouseDown(e) }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* .card-inner clips the color-bar's corners to match border-radius */}
      <div className="card-inner">
        <div
          className={`card-color-bar style-${card.color_bar_style || 'solid'}`}
          style={{ backgroundColor: card.color }}
        />
        <div className="card-body">
          {editingTitle ? (
            <input
              ref={titleRef}
              className="card-title-input"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle()
                if (e.key === 'Escape') { setDraftTitle(card.title); setEditingTitle(false) }
              }}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className="card-title"
              onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true) }}
            >
              {card.title || 'Untitled'}
            </div>
          )}
          <div className="card-meta">
            {statusDot && (
              <span className="card-meta-pill">
                <span className="dot" style={{ background: statusDot }} />
                {card.status}
              </span>
            )}
            {card.assignee && (
              <span className="card-meta-pill">
                <span className="dot" style={{ background: assigneeDot }} />
                @{card.assignee}
              </span>
            )}
            {card.estimate != null && card.estimate !== '' && (
              <span className="card-meta-pill">{card.estimate}p</span>
            )}
            {card.tags?.length > 0 && (
              <span className="card-meta-pill">
                <span className="dot" style={{ background: tagDot }} />
                #{card.tags[0]}{card.tags.length > 1 ? ` +${card.tags.length - 1}` : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {handles}
      {resizeHandle}
    </div>
  )
}

// (Table cells live in TableNode.jsx now.)
