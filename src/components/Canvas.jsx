import { useEffect, useMemo, useRef, useState } from 'react'
import CardNode from './CardNode'
import Connector from './Connector'
import '../styles/Canvas.css'

const MIN_ZOOM = 0.2
const MAX_ZOOM = 3

export default function Canvas({
  cards,
  connectors,
  selectedId,
  onSelect,
  onOpenDetail,
  onCreateCard,
  onUpdateCard,
  onDeleteCard,
  onCreateConnector,
  onDeleteConnector,
  tool,
  setTool,
}) {
  const containerRef = useRef(null)
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 })
  const [panning, setPanning] = useState(null)
  const [dragging, setDragging] = useState(null) // { id, offsetX, offsetY }
  const [linking, setLinking] = useState(null) // { sourceId, x, y } in world coords
  const [hoveredCardId, setHoveredCardId] = useState(null)
  const [selectedConnectorId, setSelectedConnectorId] = useState(null)

  const cardsById = useMemo(() => {
    const m = {}
    cards.forEach((c) => (m[c.id] = c))
    return m
  }, [cards])

  const screenToWorld = (sx, sy) => {
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: (sx - rect.left - view.x) / view.zoom,
      y: (sy - rect.top - view.y) / view.zoom,
    }
  }

  const onWheel = (e) => {
    e.preventDefault()
    const rect = containerRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    if (e.ctrlKey || e.metaKey) {
      // Pinch-zoom on trackpads emits ctrlKey
      const factor = Math.exp(-e.deltaY * 0.01)
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor))
      // keep cursor anchored
      const wx = (mx - view.x) / view.zoom
      const wy = (my - view.y) / view.zoom
      setView({
        zoom: newZoom,
        x: mx - wx * newZoom,
        y: my - wy * newZoom,
      })
    } else {
      setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
    }
  }

  const onMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey) || (e.button === 0 && e.target === containerRef.current && tool === 'select' && !linking)) {
      setPanning({ x: e.clientX, y: e.clientY, vx: view.x, vy: view.y })
      setSelectedConnectorId(null)
      onSelect(null)
      return
    }

    if (e.button === 0 && e.target === containerRef.current) {
      if (tool === 'card') {
        const { x, y } = screenToWorld(e.clientX, e.clientY)
        onCreateCard(x - 120, y - 50)
        setTool('select')
      }
    }
  }

  const onMouseMove = (e) => {
    if (panning) {
      setView((v) => ({
        ...v,
        x: panning.vx + (e.clientX - panning.x),
        y: panning.vy + (e.clientY - panning.y),
      }))
      return
    }
    if (dragging) {
      const { x, y } = screenToWorld(e.clientX, e.clientY)
      onUpdateCard(dragging.id, {
        x: x - dragging.offsetX,
        y: y - dragging.offsetY,
      })
      return
    }
    if (linking) {
      const { x, y } = screenToWorld(e.clientX, e.clientY)
      setLinking((l) => ({ ...l, x, y }))
    }
  }

  const onMouseUp = (e) => {
    if (panning) setPanning(null)
    if (dragging) setDragging(null)
    if (linking) {
      // find target card under cursor
      const { x, y } = screenToWorld(e.clientX, e.clientY)
      const target = cards.find(
        (c) =>
          c.id !== linking.sourceId &&
          x >= c.x &&
          x <= c.x + c.width &&
          y >= c.y &&
          y <= c.y + c.height,
      )
      if (target) onCreateConnector(linking.sourceId, target.id)
      setLinking(null)
    }
  }

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return
        if (selectedId) {
          onDeleteCard(selectedId)
        } else if (selectedConnectorId) {
          onDeleteConnector(selectedConnectorId)
          setSelectedConnectorId(null)
        }
      }
      if (e.key === 'Escape') {
        onSelect(null)
        setLinking(null)
        setTool('select')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, selectedConnectorId, onDeleteCard, onDeleteConnector, onSelect, setTool])

  const startDrag = (e, card) => {
    e.stopPropagation()
    onSelect(card.id)
    const { x, y } = screenToWorld(e.clientX, e.clientY)
    setDragging({ id: card.id, offsetX: x - card.x, offsetY: y - card.y })
  }

  const startLink = (e, card) => {
    e.stopPropagation()
    const { x, y } = screenToWorld(e.clientX, e.clientY)
    setLinking({ sourceId: card.id, x, y })
  }

  const cursorClass =
    tool === 'card' ? 'cursor-add' : panning ? 'cursor-grabbing' : 'cursor-default'

  return (
    <div
      ref={containerRef}
      className={`canvas ${cursorClass}`}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div
        className="canvas-grid"
        style={{
          backgroundPosition: `${view.x}px ${view.y}px`,
          backgroundSize: `${24 * view.zoom}px ${24 * view.zoom}px`,
        }}
      />

      <div
        className="canvas-world"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <svg className="connectors-layer" width="20000" height="20000" style={{ left: -10000, top: -10000 }}>
          {connectors.map((conn) => {
            const src = cardsById[conn.source_card_id]
            const tgt = cardsById[conn.target_card_id]
            if (!src || !tgt) return null
            return (
              <Connector
                key={conn.id}
                source={src}
                target={tgt}
                offset={{ x: 10000, y: 10000 }}
                selected={selectedConnectorId === conn.id}
                onSelect={() => {
                  setSelectedConnectorId(conn.id)
                  onSelect(null)
                }}
              />
            )
          })}
          {linking && cardsById[linking.sourceId] && (
            <Connector
              source={cardsById[linking.sourceId]}
              targetPoint={{ x: linking.x, y: linking.y }}
              offset={{ x: 10000, y: 10000 }}
              ghost
            />
          )}
        </svg>

        {cards.map((card) => (
          <CardNode
            key={card.id}
            card={card}
            selected={selectedId === card.id}
            hovered={hoveredCardId === card.id}
            onMouseDown={(e) => startDrag(e, card)}
            onDoubleClick={() => onOpenDetail(card.id)}
            onMouseEnter={() => setHoveredCardId(card.id)}
            onMouseLeave={() => setHoveredCardId(null)}
            onStartLink={(e) => startLink(e, card)}
            onResize={(w, h) => onUpdateCard(card.id, { width: w, height: h })}
            onTitleChange={(t) => onUpdateCard(card.id, { title: t })}
          />
        ))}
      </div>

      <div className="zoom-indicator">
        <button onClick={() => setView((v) => ({ ...v, zoom: Math.max(MIN_ZOOM, v.zoom - 0.1) }))}>−</button>
        <span>{Math.round(view.zoom * 100)}%</span>
        <button onClick={() => setView((v) => ({ ...v, zoom: Math.min(MAX_ZOOM, v.zoom + 0.1) }))}>+</button>
        <button title="Reset view" onClick={() => setView({ x: 0, y: 0, zoom: 1 })}>⌂</button>
      </div>
    </div>
  )
}
