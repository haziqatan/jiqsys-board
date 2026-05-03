import { useEffect, useMemo, useRef, useState } from 'react'
import CardNode from './CardNode'
import Connector, { pickAnchor, rectCenter, getPathSegments } from './Connector'
import ConnectorToolbar from './ConnectorToolbar'
import { IconPlus, IconMinus, IconHome } from './Icons'
import '../styles/Canvas.css'

const MIN_ZOOM = 0.2
const MAX_ZOOM = 3
const WORLD_OFFSET = 10000
const SNAP_THRESHOLD_PX = 8
const isDetailCard = (card) => (card?.node_shape || 'rect') === 'rect'

const boundsOf = (card, x = card.x, y = card.y) => ({
  id: card.id,
  x,
  y,
  width: card.width,
  height: card.height,
  left: x,
  centerX: x + card.width / 2,
  right: x + card.width,
  top: y,
  centerY: y + card.height / 2,
  bottom: y + card.height,
})

const rangesOverlap = (a1, a2, b1, b2) => Math.max(a1, b1) <= Math.min(a2, b2)

function getSnapResult({ cards, movingCard, draftX, draftY, zoom }) {
  const threshold = SNAP_THRESHOLD_PX / zoom
  const others = cards.filter((card) => card.id !== movingCard.id).map((card) => boundsOf(card))
  let x = draftX
  let y = draftY
  const guides = []

  const findAxisSnap = (axis) => {
    const isX = axis === 'x'
    const size = isX ? movingCard.width : movingCard.height
    const draftStart = isX ? draftX : draftY
    const movingEdges = [
      { key: 'start', value: draftStart, offset: 0 },
      { key: 'center', value: draftStart + size / 2, offset: size / 2 },
      { key: 'end', value: draftStart + size, offset: size },
    ]
    const targetKeys = isX
      ? ['left', 'centerX', 'right']
      : ['top', 'centerY', 'bottom']

    let best = null
    for (const other of others) {
      for (const movingEdge of movingEdges) {
        for (const key of targetKeys) {
          const diff = other[key] - movingEdge.value
          if (Math.abs(diff) > threshold) continue
          if (!best || Math.abs(diff) < Math.abs(best.diff)) {
            best = { diff, coordinate: other[key], movingEdge, other }
          }
        }
      }
    }
    return best
  }

  const snapX = findAxisSnap('x')
  if (snapX) x = draftX + snapX.diff
  const snapY = findAxisSnap('y')
  if (snapY) y = draftY + snapY.diff

  let moving = boundsOf(movingCard, x, y)
  const equalSpacing = getEqualSpacingSnap(moving, others, threshold)
  if (!snapX && equalSpacing.dx !== 0) x += equalSpacing.dx
  if (!snapY && equalSpacing.dy !== 0) y += equalSpacing.dy
  moving = boundsOf(movingCard, x, y)

  if (snapX) {
    guides.push({
      axis: 'x',
      x: snapX.coordinate,
      y1: Math.min(moving.top, snapX.other.top) - 24,
      y2: Math.max(moving.bottom, snapX.other.bottom) + 24,
    })
  }
  if (snapY) {
    guides.push({
      axis: 'y',
      y: snapY.coordinate,
      x1: Math.min(moving.left, snapY.other.left) - 24,
      x2: Math.max(moving.right, snapY.other.right) + 24,
    })
  }

  return {
    x,
    y,
    visual: {
      guides,
      measurements: getSpacingMeasurements(moving, others),
    },
  }
}

function getSpacingNeighbors(moving, others) {
  let leftNeighbor = null
  let rightNeighbor = null
  let topNeighbor = null
  let bottomNeighbor = null

  for (const other of others) {
    if (rangesOverlap(moving.top, moving.bottom, other.top, other.bottom)) {
      if (other.right <= moving.left) {
        const gap = moving.left - other.right
        if (!leftNeighbor || gap < leftNeighbor.gap) leftNeighbor = { other, gap }
      }
      if (moving.right <= other.left) {
        const gap = other.left - moving.right
        if (!rightNeighbor || gap < rightNeighbor.gap) rightNeighbor = { other, gap }
      }
    }
    if (rangesOverlap(moving.left, moving.right, other.left, other.right)) {
      if (other.bottom <= moving.top) {
        const gap = moving.top - other.bottom
        if (!topNeighbor || gap < topNeighbor.gap) topNeighbor = { other, gap }
      }
      if (moving.bottom <= other.top) {
        const gap = other.top - moving.bottom
        if (!bottomNeighbor || gap < bottomNeighbor.gap) bottomNeighbor = { other, gap }
      }
    }
  }

  return { leftNeighbor, rightNeighbor, topNeighbor, bottomNeighbor }
}

function getEqualSpacingSnap(moving, others, threshold) {
  const { leftNeighbor, rightNeighbor, topNeighbor, bottomNeighbor } =
    getSpacingNeighbors(moving, others)
  let dx = 0
  let dy = 0

  if (leftNeighbor && rightNeighbor) {
    const nextDx = (rightNeighbor.gap - leftNeighbor.gap) / 2
    if (Math.abs(nextDx) <= threshold) dx = nextDx
  }
  if (topNeighbor && bottomNeighbor) {
    const nextDy = (bottomNeighbor.gap - topNeighbor.gap) / 2
    if (Math.abs(nextDy) <= threshold) dy = nextDy
  }

  return { dx, dy }
}

function getSpacingMeasurements(moving, others) {
  const measurements = []
  const { leftNeighbor, rightNeighbor, topNeighbor, bottomNeighbor } =
    getSpacingNeighbors(moving, others)

  if (leftNeighbor && leftNeighbor.gap > 0) {
    const y = Math.min(moving.top, leftNeighbor.other.top) - 18
    measurements.push({
      axis: 'x',
      x1: leftNeighbor.other.right,
      x2: moving.left,
      y,
      label: Math.round(leftNeighbor.gap),
    })
  }
  if (rightNeighbor && rightNeighbor.gap > 0) {
    const y = Math.min(moving.top, rightNeighbor.other.top) - 18
    measurements.push({
      axis: 'x',
      x1: moving.right,
      x2: rightNeighbor.other.left,
      y,
      label: Math.round(rightNeighbor.gap),
    })
  }
  if (topNeighbor && topNeighbor.gap > 0) {
    const x = Math.min(moving.left, topNeighbor.other.left) - 18
    measurements.push({
      axis: 'y',
      y1: topNeighbor.other.bottom,
      y2: moving.top,
      x,
      label: Math.round(topNeighbor.gap),
    })
  }
  if (bottomNeighbor && bottomNeighbor.gap > 0) {
    const x = Math.min(moving.left, bottomNeighbor.other.left) - 18
    measurements.push({
      axis: 'y',
      y1: moving.bottom,
      y2: bottomNeighbor.other.top,
      x,
      label: Math.round(bottomNeighbor.gap),
    })
  }

  return measurements
}

export default function Canvas({
  cards,
  connectors,
  statusOptions,
  assigneeOptions,
  tagOptions,
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
  const [snapVisual, setSnapVisual] = useState(null)
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

    if (e.button === 0 && isEmpty && (tool === 'card' || tool === 'text' || tool.startsWith('card-'))) {
      const { x, y } = screenToWorld(e.clientX, e.clientY)
      const shapeMap = {
        'card':            { node_shape: 'rect',          w: 240, h: 100, title: 'New card', color: '#3b82f6' },
        'text':            { node_shape: 'text',          w: 140, h: 36,  title: 'Text',     color: 'transparent' },
        'card-rect-shape': { node_shape: 'rectangle',     w: 180, h: 100, title: '',         color: '#dbeafe' },
        'card-square':     { node_shape: 'square',        w: 120, h: 120, title: '',         color: '#dbeafe' },
        'card-circle':     { node_shape: 'circle',        w: 140, h: 140, title: '',         color: '#dbeafe' },
        'card-diamond':    { node_shape: 'diamond',       w: 160, h: 160, title: '',         color: '#dbeafe' },
        'card-hex':        { node_shape: 'hexagon',       w: 180, h: 160, title: '',         color: '#dbeafe' },
        'card-para':       { node_shape: 'parallelogram', w: 220, h: 100, title: '',         color: '#dbeafe' },
        'card-triangle':   { node_shape: 'triangle',      w: 160, h: 140, title: '',         color: '#dbeafe' },
        'card-star':       { node_shape: 'star',          w: 160, h: 160, title: '',         color: '#fef3c7' },
        'card-arrow':      { node_shape: 'arrow',         w: 200, h: 90,  title: '',         color: '#dbeafe' },
      }
      const { node_shape, w, h, title, color } = shapeMap[tool] || shapeMap['card']
      onCreateCard(x - w / 2, y - h / 2, { node_shape, width: w, height: h, title, color })
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
      const movingCard = cardsById[dragging.id]
      if (!movingCard) return
      const snap = getSnapResult({
        cards,
        movingCard,
        draftX: x - dragging.offsetX,
        draftY: y - dragging.offsetY,
        zoom: view.zoom,
      })
      setSnapVisual(snap.visual)
      onUpdateCard(dragging.id, {
        x: snap.x,
        y: snap.y,
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
    if (dragging) {
      setDragging(null)
      setSnapVisual(null)
    }
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
        if (e.key === 't' || e.key === 'T') setTool('text')
        if (e.key === 'Escape' && tool !== 'select') setTool('select')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, selectedConnectorId, onDeleteCard, onDeleteConnector, onSelect, setTool, tool])

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
    : (tool === 'card' || tool === 'text' || tool.startsWith('card-'))
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
            onDoubleClick={() => {
              if (isDetailCard(card)) onOpenDetail(card.id)
            }}
            onMouseEnter={() => setHoveredCardId(card.id)}
            onMouseLeave={() => setHoveredCardId(null)}
            onStartLink={(e, side) => startLink(e, card, side)}
            onResize={(w, h) => onUpdateCard(card.id, { width: w, height: h })}
            onTitleChange={(t) => onUpdateCard(card.id, { title: t })}
            statusOptions={statusOptions}
            assigneeOptions={assigneeOptions}
            tagOptions={tagOptions}
          />
        ))}

        {snapVisual && <SnapGuides visual={snapVisual} offset={WORLD_OFFSET} zoom={view.zoom} />}
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

function SnapGuides({ visual, offset, zoom }) {
  const fontSize = 12 / zoom
  const labelH = 18 / zoom
  const tick = 6 / zoom

  return (
    <svg
      className="snap-guides-layer"
      width={offset * 2}
      height={offset * 2}
      style={{ left: -offset, top: -offset }}
    >
      {visual.guides.map((guide, index) => (
        guide.axis === 'x' ? (
          <line
            key={`guide-x-${index}`}
            className="snap-guide-line"
            x1={guide.x + offset}
            y1={guide.y1 + offset}
            x2={guide.x + offset}
            y2={guide.y2 + offset}
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <line
            key={`guide-y-${index}`}
            className="snap-guide-line"
            x1={guide.x1 + offset}
            y1={guide.y + offset}
            x2={guide.x2 + offset}
            y2={guide.y + offset}
            vectorEffect="non-scaling-stroke"
          />
        )
      ))}

      {visual.measurements.map((measurement, index) => {
        const label = String(measurement.label)
        const labelW = Math.max(28, label.length * 8 + 14) / zoom

        if (measurement.axis === 'x') {
          const x1 = measurement.x1 + offset
          const x2 = measurement.x2 + offset
          const y = measurement.y + offset
          const cx = (x1 + x2) / 2
          return (
            <g key={`measure-x-${index}`} className="snap-measure">
              <line x1={x1} y1={y} x2={x2} y2={y} vectorEffect="non-scaling-stroke" />
              <line x1={x1} y1={y - tick} x2={x1} y2={y + tick} vectorEffect="non-scaling-stroke" />
              <line x1={x2} y1={y - tick} x2={x2} y2={y + tick} vectorEffect="non-scaling-stroke" />
              <rect
                x={cx - labelW / 2}
                y={y - labelH / 2}
                width={labelW}
                height={labelH}
                rx={4 / zoom}
              />
              <text x={cx} y={y} fontSize={fontSize} dominantBaseline="central">
                {label}
              </text>
            </g>
          )
        }

        const x = measurement.x + offset
        const y1 = measurement.y1 + offset
        const y2 = measurement.y2 + offset
        const cy = (y1 + y2) / 2
        return (
          <g key={`measure-y-${index}`} className="snap-measure">
            <line x1={x} y1={y1} x2={x} y2={y2} vectorEffect="non-scaling-stroke" />
            <line x1={x - tick} y1={y1} x2={x + tick} y2={y1} vectorEffect="non-scaling-stroke" />
            <line x1={x - tick} y1={y2} x2={x + tick} y2={y2} vectorEffect="non-scaling-stroke" />
            <rect
              x={x - labelW / 2}
              y={cy - labelH / 2}
              width={labelW}
              height={labelH}
              rx={4 / zoom}
            />
            <text x={x} y={cy} fontSize={fontSize} dominantBaseline="central">
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
