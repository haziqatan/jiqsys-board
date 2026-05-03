import { useEffect, useMemo, useRef, useState } from 'react'
import CardNode from './CardNode'
import Connector, { pickAnchor, rectCenter, getPathSegments } from './Connector'
import ConnectorToolbar from './ConnectorToolbar'
import { IconPlus, IconMinus, IconHome } from './Icons'
import '../styles/Canvas.css'

const MIN_ZOOM = 0.2
const MAX_ZOOM = 3
const WORLD_OFFSET = 10000

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
  onUpdateConnector,
  onDeleteConnector,
  tool,
  setTool,
}) {
  const containerRef = useRef(null)
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 })
  const [panning, setPanning] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [linking, setLinking] = useState(null) // { sourceId, sourceSide, x, y }
  const [hoveredCardId, setHoveredCardId] = useState(null)
  const [selectedConnectorId, setSelectedConnectorId] = useState(null)

  const cardsById = useMemo(() => {
    const m = {}
    cards.forEach((c) => (m[c.id] = c))
    return m
  }, [cards])

  // For each connector, compute its rendered line segments in world+offset coords.
  // Used to detect crossings between connectors so we can draw line-jump arcs.
  const connectorSegments = useMemo(() => {
    const map = {}
    for (const conn of connectors) {
      const src = cardsById[conn.source_card_id]
      const tgt = cardsById[conn.target_card_id]
      if (!src || !tgt) continue
      const shape = conn.shape || 'orthogonal'
      if (shape === 'curved') {
        map[conn.id] = []
        continue
      }
      if (shape === 'rounded') {
        // use orthogonal segments for line-jump intersection tests
      }
      const sAnchor = pickAnchor(src, rectCenter(tgt), conn.source_side)
      const tAnchor = pickAnchor(tgt, rectCenter(src), conn.target_side)
      const S = { ...sAnchor, x: sAnchor.x + WORLD_OFFSET, y: sAnchor.y + WORLD_OFFSET }
      const T = { ...tAnchor, x: tAnchor.x + WORLD_OFFSET, y: tAnchor.y + WORLD_OFFSET }
      const segs = getPathSegments(S, T, shape)
      map[conn.id] = segs.map(([a, b]) => ({ a, b }))
    }
    return map
  }, [connectors, cardsById])

  const screenToWorld = (sx, sy) => {
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: (sx - rect.left - view.x) / view.zoom,
      y: (sy - rect.top - view.y) / view.zoom,
    }
  }

  const worldToScreen = (wx, wy) => ({
    x: wx * view.zoom + view.x,
    y: wy * view.zoom + view.y,
  })

  const onWheel = (e) => {
    e.preventDefault()
    const rect = containerRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    if (e.ctrlKey || e.metaKey) {
      // Pinch / cmd+wheel zoom — clamped per-event so it doesn't snap
      const delta = Math.max(-50, Math.min(50, e.deltaY))
      const factor = Math.exp(-delta * 0.008)
      setView((v) => {
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor))
        const wx = (mx - v.x) / v.zoom
        const wy = (my - v.y) / v.zoom
        return {
          zoom: newZoom,
          x: mx - wx * newZoom,
          y: my - wy * newZoom,
        }
      })
    } else {
      setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
    }
  }

  const onMouseDown = (e) => {
    const isEmpty = e.target === containerRef.current || e.target.classList.contains('canvas-grid')
    if (e.button === 1 || (e.button === 0 && e.altKey) || (e.button === 0 && isEmpty && tool === 'select' && !linking)) {
      setPanning({ x: e.clientX, y: e.clientY, vx: view.x, vy: view.y })
      setSelectedConnectorId(null)
      onSelect(null)
      return
    }

    if (e.button === 0 && isEmpty && tool.startsWith('card')) {
      const { x, y } = screenToWorld(e.clientX, e.clientY)
      const shapeMap = {
        'card':         { node_shape: 'rect',          w: 240, h: 100 },
        'card-circle':  { node_shape: 'circle',        w: 140, h: 140 },
        'card-diamond': { node_shape: 'diamond',       w: 160, h: 160 },
        'card-hex':     { node_shape: 'hexagon',       w: 180, h: 160 },
        'card-para':    { node_shape: 'parallelogram', w: 240, h: 100 },
      }
      const { node_shape, w, h } = shapeMap[tool] || shapeMap['card']
      onCreateCard(x - w / 2, y - h / 2, { node_shape, width: w, height: h })
      setTool('select')
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
      const { x, y } = screenToWorld(e.clientX, e.clientY)
      const target = cards.find(
        (c) =>
          c.id !== linking.sourceId &&
          x >= c.x &&
          x <= c.x + c.width &&
          y >= c.y &&
          y <= c.y + c.height,
      )
      if (target) {
        // pick target side closest to drop point
        const tCenter = rectCenter(target)
        const dx = x - tCenter.x
        const dy = y - tCenter.y
        let targetSide
        if (Math.abs(dx) * target.height >= Math.abs(dy) * target.width) {
          targetSide = dx >= 0 ? 'right' : 'left'
        } else {
          targetSide = dy >= 0 ? 'bottom' : 'top'
        }
        onCreateConnector(linking.sourceId, target.id, {
          source_side: linking.sourceSide || null,
          target_side: targetSide,
        })
      }
      setLinking(null)
    }
  }

  useEffect(() => {
    const isTyping = (el) =>
      el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    const onKey = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isTyping(e.target)) return
        if (selectedId) onDeleteCard(selectedId)
        else if (selectedConnectorId) {
          onDeleteConnector(selectedConnectorId)
          setSelectedConnectorId(null)
        }
      }
      if (e.key === 'Escape') {
        onSelect(null)
        setSelectedConnectorId(null)
        setLinking(null)
        setTool('select')
      }
      if (!isTyping(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === 'v' || e.key === 'V') setTool('select')
        if (e.key === 'c' || e.key === 'C') setTool('card')
        if (e.key === 'Escape' && tool !== 'select') setTool('select')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, selectedConnectorId, onDeleteCard, onDeleteConnector, onSelect, setTool])

  const startDrag = (e, card) => {
    e.stopPropagation()
    onSelect(card.id)
    setSelectedConnectorId(null)
    const { x, y } = screenToWorld(e.clientX, e.clientY)
    setDragging({ id: card.id, offsetX: x - card.x, offsetY: y - card.y })
  }

  const startLink = (e, card, side) => {
    e.stopPropagation()
    const { x, y } = screenToWorld(e.clientX, e.clientY)
    setLinking({ sourceId: card.id, sourceSide: side, x, y })
  }

  // Compute toolbar position for selected connector
  const selectedConnector = selectedConnectorId
    ? connectors.find((c) => c.id === selectedConnectorId)
    : null
  let toolbarPos = null
  if (selectedConnector) {
    const src = cardsById[selectedConnector.source_card_id]
    const tgt = cardsById[selectedConnector.target_card_id]
    if (src && tgt) {
      const sAnchor = pickAnchor(src, rectCenter(tgt), selectedConnector.source_side)
      const tAnchor = pickAnchor(tgt, rectCenter(src), selectedConnector.target_side)
      const midWorld = {
        x: (sAnchor.x + tAnchor.x) / 2,
        y: (sAnchor.y + tAnchor.y) / 2,
      }
      const screen = worldToScreen(midWorld.x, midWorld.y)
      toolbarPos = { x: screen.x, y: screen.y - 60 }
    }
  }

  const cursorClass = panning
    ? 'cursor-grabbing'
    : tool.startsWith('card')
    ? 'cursor-add'
    : 'cursor-grab'

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
        <svg
          className="connectors-layer"
          width={WORLD_OFFSET * 2}
          height={WORLD_OFFSET * 2}
          style={{ left: -WORLD_OFFSET, top: -WORLD_OFFSET }}
        >
          {connectors.map((conn) => {
            const src = cardsById[conn.source_card_id]
            const tgt = cardsById[conn.target_card_id]
            if (!src || !tgt) return null
            const shape = conn.shape || 'orthogonal'
            const wantsJumps = (conn.line_jumps ?? true) && shape !== 'curved'
            const crossings = wantsJumps
              ? Object.entries(connectorSegments)
                  .filter(([id]) => id !== conn.id)
                  .flatMap(([, segs]) => segs)
              : []
            return (
              <Connector
                key={conn.id}
                conn={conn}
                source={src}
                target={tgt}
                offset={{ x: WORLD_OFFSET, y: WORLD_OFFSET }}
                selected={selectedConnectorId === conn.id}
                crossingSegments={crossings}
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
              offset={{ x: WORLD_OFFSET, y: WORLD_OFFSET }}
              ghost
              conn={{ source_side: linking.sourceSide }}
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
            onStartLink={(e, side) => startLink(e, card, side)}
            onResize={(w, h) => onUpdateCard(card.id, { width: w, height: h })}
            onTitleChange={(t) => onUpdateCard(card.id, { title: t })}
          />
        ))}
      </div>

      {selectedConnector && toolbarPos && (
        <ConnectorToolbar
          connector={selectedConnector}
          screenX={toolbarPos.x}
          screenY={toolbarPos.y}
          onUpdate={(patch) => onUpdateConnector(selectedConnector.id, patch)}
          onDelete={() => {
            onDeleteConnector(selectedConnector.id)
            setSelectedConnectorId(null)
          }}
        />
      )}

      <div className="zoom-indicator">
        <button
          aria-label="Zoom out"
          onClick={() => setView((v) => ({ ...v, zoom: Math.max(MIN_ZOOM, v.zoom - 0.1) }))}
        >
          <IconMinus width={16} height={16} />
        </button>
        <span>{Math.round(view.zoom * 100)}%</span>
        <button
          aria-label="Zoom in"
          onClick={() => setView((v) => ({ ...v, zoom: Math.min(MAX_ZOOM, v.zoom + 0.1) }))}
        >
          <IconPlus width={16} height={16} />
        </button>
        <span className="zoom-divider" />
        <button aria-label="Reset view" onClick={() => setView({ x: 0, y: 0, zoom: 1 })}>
          <IconHome width={16} height={16} />
        </button>
      </div>

      {cards.length === 0 && (
        <div className="canvas-empty">
          <div className="canvas-empty-icon">＋</div>
          <div className="canvas-empty-title">Start your board</div>
          <div className="canvas-empty-hint">
            Press <kbd>C</kbd> to add a card, or click the card tool on the left
          </div>
        </div>
      )}
    </div>
  )
}
