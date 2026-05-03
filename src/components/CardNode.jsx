import { useEffect, useRef, useState } from 'react'
import '../styles/CardNode.css'

const STATUS_COLORS = {
  'To Do': '#94a3b8',
  'In Progress': '#3b82f6',
  Blocked: '#ef4444',
  Done: '#22c55e',
}

const SHAPE_CLIP = {
  diamond:       'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  hexagon:       'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
  parallelogram: 'polygon(12% 0%, 100% 0%, 88% 100%, 0% 100%)',
}

// Extra vertical padding around textarea inside each shape (compensates for clip whitespace)
const SHAPE_PAD = { circle: 36, diamond: 70, hexagon: 50, parallelogram: 28 }

const MIN_SIZE = {
  rect:          { w: 140, h: 60  },
  circle:        { w: 80,  h: 80  },
  diamond:       { w: 110, h: 110 },
  hexagon:       { w: 130, h: 110 },
  parallelogram: { w: 150, h: 72  },
}

export default function CardNode({
  card,
  selected,
  hovered,
  onMouseDown,
  onDoubleClick,
  onMouseEnter,
  onMouseLeave,
  onStartLink,
  onResize,
  onTitleChange,
}) {
  const nodeShape = card.node_shape || 'rect'
  const [editingTitle, setEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState(card.title)
  const [editH, setEditH] = useState(null)
  const titleRef = useRef(null)
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
      if (shape === 'circle') { const s = Math.max(w, h); w = s; h = s }
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
      const newW = nodeShape === 'circle' ? newH : card.width
      onResize(newW, newH)
      setEditH(null)
    }
    if (draftTitle !== card.title) onTitleChange(draftTitle)
  }

  const showHandles = selected || hovered
  const displayH = editH ?? card.height
  const displayW = (nodeShape === 'circle' && editH != null) ? editH : card.width

  // Shared: link handles on all four sides
  const handles = showHandles && (
    <>
      <div className="link-handle top"    onMouseDown={(e) => onStartLink(e, 'top')} />
      <div className="link-handle right"  onMouseDown={(e) => onStartLink(e, 'right')} />
      <div className="link-handle bottom" onMouseDown={(e) => onStartLink(e, 'bottom')} />
      <div className="link-handle left"   onMouseDown={(e) => onStartLink(e, 'left')} />
    </>
  )

  // Shared: resize grip at bottom-right
  const resizeHandle = selected && (
    <div className="resize-handle" onMouseDown={startResize}>
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <path d="M1 7L7 1" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M4.5 7L7 4.5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
  )

  // ── SHAPE NODE (non-rect) ────────────────────────────────────────────
  if (nodeShape !== 'rect') {
    const clipPath = SHAPE_CLIP[nodeShape]
    const isCircle = nodeShape === 'circle'
    const pad = SHAPE_PAD[nodeShape] ?? 36
    const taHeight = Math.max(40, displayH - pad)

    const handleInput = (e) => {
      const ta = e.target
      ta.style.height = '0px'
      const min = MIN_SIZE[nodeShape] || MIN_SIZE.rect
      setEditH(Math.max(min.h, ta.scrollHeight + pad))
      setDraftTitle(ta.value)
    }

    return (
      <div
        className={`card-node shape-node shape-${nodeShape}${selected ? ' selected' : ''}`}
        style={{ left: card.x, top: card.y, width: displayW, height: displayH }}
        onMouseDown={(e) => { if (editingTitle) return; onMouseDown(e) }}
        onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true) }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* Clipped colored background — clip-path/border-radius applied here, not on outer */}
        <div
          className="shape-bg"
          style={{
            background: card.color || 'var(--accent-soft)',
            ...(isCircle ? { borderRadius: '50%' } : { clipPath }),
          }}
        />

        {/* Text layer — floats above the bg, centered */}
        {editingTitle ? (
          <textarea
            ref={titleRef}
            className="shape-text-edit"
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
  const statusDot = card.status ? STATUS_COLORS[card.status] || '#94a3b8' : null

  return (
    <div
      className={`card-node shape-rect${selected ? ' selected' : ''}`}
      style={{ left: card.x, top: card.y, width: card.width, height: card.height }}
      onMouseDown={(e) => { if (editingTitle) return; onMouseDown(e) }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* .card-inner clips the color-bar's corners to match border-radius */}
      <div className="card-inner">
        <div className="card-color-bar" style={{ background: card.color }} />
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
            {card.assignee && <span className="card-meta-pill">@{card.assignee}</span>}
            {card.estimate != null && card.estimate !== '' && (
              <span className="card-meta-pill">{card.estimate}p</span>
            )}
            {card.tags?.length > 0 && (
              <span className="card-meta-pill">
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
