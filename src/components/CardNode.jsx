import { useEffect, useRef, useState } from 'react'
import '../styles/CardNode.css'

const STATUS_COLORS = {
  'To Do': '#94a3b8',
  'In Progress': '#3b82f6',
  Blocked: '#ef4444',
  Done: '#22c55e',
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
  const [editingTitle, setEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState(card.title)
  const titleRef = useRef(null)
  const [resizing, setResizing] = useState(null)

  useEffect(() => {
    if (editingTitle && titleRef.current) {
      titleRef.current.focus()
      titleRef.current.select()
    }
  }, [editingTitle])

  useEffect(() => {
    if (!resizing) return
    const onMove = (e) => {
      const dx = (e.clientX - resizing.startX) / resizing.zoom
      const dy = (e.clientY - resizing.startY) / resizing.zoom
      onResize(
        Math.max(140, resizing.startW + dx),
        Math.max(60, resizing.startH + dy),
      )
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
    // Find current zoom from the world transform
    const world = e.currentTarget.closest('.canvas-world')
    const matrix = window.getComputedStyle(world).transform
    let zoom = 1
    if (matrix && matrix !== 'none') {
      const m = matrix.match(/matrix\(([^,]+),/)
      if (m) zoom = parseFloat(m[1])
    }
    setResizing({
      startX: e.clientX,
      startY: e.clientY,
      startW: card.width,
      startH: card.height,
      zoom,
    })
  }

  const commitTitle = () => {
    setEditingTitle(false)
    if (draftTitle !== card.title) onTitleChange(draftTitle)
  }

  const beginEditingTitle = () => {
    setDraftTitle(card.title)
    setEditingTitle(true)
  }

  const statusDot = card.status ? STATUS_COLORS[card.status] || '#94a3b8' : null
  const showHandles = selected || hovered
  const nodeShape = card.node_shape || 'rect'
  const isPlainShape = nodeShape !== 'rect'
  const displayTitle = isPlainShape ? card.title : card.title || 'Untitled'

  const shapeStyle = {}
  if (nodeShape === 'circle') {
    shapeStyle.borderRadius = '50%'
  } else if (nodeShape === 'diamond') {
    shapeStyle.clipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
    shapeStyle.borderRadius = 0
    shapeStyle.overflow = 'visible'
  } else if (nodeShape === 'hexagon') {
    shapeStyle.clipPath = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'
    shapeStyle.borderRadius = 0
    shapeStyle.overflow = 'visible'
  } else if (nodeShape === 'parallelogram') {
    shapeStyle.clipPath = 'polygon(12% 0%, 100% 0%, 88% 100%, 0% 100%)'
    shapeStyle.borderRadius = 0
    shapeStyle.overflow = 'visible'
  }

  return (
    <div
      className={`card-node shape-${nodeShape} ${isPlainShape ? 'plain-shape' : ''} ${selected ? 'selected' : ''}`}
      style={{
        left: card.x,
        top: card.y,
        width: card.width,
        height: card.height,
        ...shapeStyle,
      }}
      onMouseDown={(e) => {
        if (editingTitle) return
        onMouseDown(e)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (isPlainShape) {
          beginEditingTitle()
          return
        }
        onDoubleClick()
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {!isPlainShape && <div className="card-color-bar" style={{ background: card.color }} />}

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
              if (e.key === 'Escape') {
                setDraftTitle(card.title)
                setEditingTitle(false)
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="card-title"
            onDoubleClick={(e) => {
              e.stopPropagation()
              beginEditingTitle()
            }}
          >
            {displayTitle}
          </div>
        )}

        {!isPlainShape && (
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
            {card.tags && card.tags.length > 0 && (
              <span className="card-meta-pill">#{card.tags[0]}{card.tags.length > 1 ? ` +${card.tags.length - 1}` : ''}</span>
            )}
          </div>
        )}
      </div>

      {showHandles && (
        <>
          <div className="link-handle top" onMouseDown={(e) => onStartLink(e, 'top')} />
          <div className="link-handle right" onMouseDown={(e) => onStartLink(e, 'right')} />
          <div className="link-handle bottom" onMouseDown={(e) => onStartLink(e, 'bottom')} />
          <div className="link-handle left" onMouseDown={(e) => onStartLink(e, 'left')} />
        </>
      )}

      {selected && (
        <div className="resize-handle" onMouseDown={startResize}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1 7L7 1" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M4.5 7L7 4.5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      )}
    </div>
  )
}
