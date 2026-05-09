import { useEffect, useMemo, useRef, useState } from 'react'
import CardNode from './CardNode'
import Connector, { pickAnchor, rectCenter, getPathSegmentsWithWaypoints } from './Connector'
import ConnectorToolbar from './ConnectorToolbar'
import { IconPlus, IconMinus, IconHome } from './Icons'
import { isBugsStatus } from '../lib/status'
import '../styles/Canvas.css'

const MIN_ZOOM = 0.2
const MAX_ZOOM = 3
const WORLD_OFFSET = 10000
const SNAP_THRESHOLD_PX = 6
const PASTE_OFFSET = 32
const PASTED_IMAGE_MAX_SIZE = 420
// Only consider cards whose bounding box edge-distance is within this multiple of
// the moving card's larger side. Anything farther is "not the nearest object".
const NEARBY_FACTOR = 4
const isDetailCard = (card) => (card?.node_shape || 'rect') === 'rect'

// Edge-to-edge distance between two AABBs (0 if overlapping).
function rectDistance(a, b) {
  const dx = Math.max(0, Math.max(a.left - b.right, b.left - a.right))
  const dy = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom))
  return Math.hypot(dx, dy)
}

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

function collectBugsFlowConnectorIds(cards, connectors) {
  const bugsCardIds = new Set(
    cards.filter((card) => isBugsStatus(card.status)).map((card) => card.id),
  )
  const affectedConnectorIds = new Set()
  if (bugsCardIds.size === 0) return affectedConnectorIds

  const outgoingBySource = new Map()
  const incomingByTarget = new Map()

  for (const conn of connectors) {
    if (!outgoingBySource.has(conn.source_card_id)) outgoingBySource.set(conn.source_card_id, [])
    if (!incomingByTarget.has(conn.target_card_id)) incomingByTarget.set(conn.target_card_id, [])
    outgoingBySource.get(conn.source_card_id).push(conn)
    incomingByTarget.get(conn.target_card_id).push(conn)
  }

  const walk = (adjacency, nextCardIdFor) => {
    const queue = [...bugsCardIds]
    const visitedCardIds = new Set(bugsCardIds)

    while (queue.length > 0) {
      const cardId = queue.shift()
      const nextConnectors = adjacency.get(cardId) || []

      for (const conn of nextConnectors) {
        affectedConnectorIds.add(conn.id)
        const nextCardId = nextCardIdFor(conn)
        if (!nextCardId || visitedCardIds.has(nextCardId)) continue
        visitedCardIds.add(nextCardId)
        queue.push(nextCardId)
      }
    }
  }

  walk(outgoingBySource, (conn) => conn.target_card_id)
  walk(incomingByTarget, (conn) => conn.source_card_id)

  return affectedConnectorIds
}

const cloneCardForPaste = (card) => {
  const {
    id,
    board_id,
    created_at,
    updated_at,
    ...copyable
  } = card
  return typeof structuredClone === 'function'
    ? structuredClone(copyable)
    : JSON.parse(JSON.stringify(copyable))
}

const cloneClipboardData = (value) =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))

const cloneConnectorForPaste = (connector) => {
  const {
    id,
    board_id,
    created_at,
    updated_at,
    source_card_id,
    target_card_id,
    ...copyable
  } = connector
  return cloneClipboardData(copyable)
}

function createBoardClipboardPayload(boardId, selectedCards, boardConnectors) {
  const selectedIdSet = new Set(selectedCards.map((card) => card.id))
  const selectedConnectors = boardConnectors.filter(
    (conn) => selectedIdSet.has(conn.source_card_id) && selectedIdSet.has(conn.target_card_id),
  )

  return {
    version: 1,
    sourceBoardId: boardId,
    cards: selectedCards.map((card) => ({
      sourceId: card.id,
      data: cloneCardForPaste(card),
    })),
    connectors: selectedConnectors.map((conn) => ({
      sourceId: conn.id,
      sourceCardId: conn.source_card_id,
      targetCardId: conn.target_card_id,
      data: cloneConnectorForPaste(conn),
    })),
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function getImageDimensions(src) {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => resolve({ width: 320, height: 220 })
    image.src = src
  })
}

function fitImageSize(width, height) {
  const safeW = Math.max(1, width || 320)
  const safeH = Math.max(1, height || 220)
  const scale = Math.min(1, PASTED_IMAGE_MAX_SIZE / Math.max(safeW, safeH))
  return {
    width: Math.max(80, Math.round(safeW * scale)),
    height: Math.max(60, Math.round(safeH * scale)),
  }
}

// Compute where a "next-shape" ghost should sit relative to its source card.
// `side` is the side of the source the user is hovering. The ghost starts at
// a default offset; if it overlaps any other card, we slide further along the
// primary direction past the obstacle until we find a clear spot.
const GHOST_GAP = 80
const GHOST_PUSH = 24
const GHOST_OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

function computeGhostPosition(src, side, allCards) {
  const w = src.width
  const h = src.height
  let x = src.x
  let y = src.y
  if (side === 'right')        x = src.x + src.width  + GHOST_GAP
  else if (side === 'left')    x = src.x - w - GHOST_GAP
  else if (side === 'bottom')  y = src.y + src.height + GHOST_GAP
  else if (side === 'top')     y = src.y - h - GHOST_GAP

  const overlapsAt = (gx, gy) => {
    for (const c of allCards) {
      if (c.id === src.id) continue
      if (
        gx < c.x + c.width  && gx + w > c.x &&
        gy < c.y + c.height && gy + h > c.y
      ) return c
    }
    return null
  }

  let attempts = 0
  let collision = overlapsAt(x, y)
  while (collision && attempts < 24) {
    if (side === 'right')        x = collision.x + collision.width  + GHOST_PUSH
    else if (side === 'left')    x = collision.x - w - GHOST_PUSH
    else if (side === 'bottom')  y = collision.y + collision.height + GHOST_PUSH
    else if (side === 'top')     y = collision.y - h - GHOST_PUSH
    collision = overlapsAt(x, y)
    attempts++
  }
  return { x, y, width: w, height: h }
}

function getSnapResult({ cards, movingCard, draftX, draftY, zoom }) {
  const threshold = SNAP_THRESHOLD_PX / zoom
  const movingDraft = boundsOf(movingCard, draftX, draftY)

  // Filter to "nearby" cards only — the nearest object(s).
  // Sorted by edge-distance ascending so the closest target wins ties.
  const reach = Math.max(movingCard.width, movingCard.height) * NEARBY_FACTOR
  const others = cards
    .filter((card) => card.id !== movingCard.id)
    .map((card) => {
      const b = boundsOf(card)
      return { ...b, distance: rectDistance(movingDraft, b) }
    })
    .filter((b) => b.distance <= reach)
    .sort((a, b) => a.distance - b.distance)

  let x = draftX
  let y = draftY

  // Per axis: find the single closest other card whose edges align within threshold.
  // "Closest" = smallest rectDistance, then smallest |diff| as tiebreaker.
  const findAxisSnap = (axis) => {
    const isX = axis === 'x'
    const size = isX ? movingCard.width : movingCard.height
    const draftStart = isX ? draftX : draftY
    const movingEdges = [
      { key: 'start',  value: draftStart },
      { key: 'center', value: draftStart + size / 2 },
      { key: 'end',    value: draftStart + size },
    ]
    const targetKeys = isX ? ['left', 'centerX', 'right'] : ['top', 'centerY', 'bottom']

    for (const other of others) {
      let best = null
      for (const movingEdge of movingEdges) {
        for (const key of targetKeys) {
          const diff = other[key] - movingEdge.value
          if (Math.abs(diff) > threshold) continue
          if (!best || Math.abs(diff) < Math.abs(best.diff)) {
            best = { diff, coordinate: other[key], other }
          }
        }
      }
      if (best) return best // first (= nearest) other with any valid alignment wins
    }
    return null
  }

  const snapX = findAxisSnap('x')
  if (snapX) x = draftX + snapX.diff
  const snapY = findAxisSnap('y')
  if (snapY) y = draftY + snapY.diff

  let moving = boundsOf(movingCard, x, y)

  // Equal-spacing snap only fires if no edge alignment was found and only against
  // immediate neighbors, which getSpacingNeighbors already enforces.
  if (!snapX || !snapY) {
    const equalSpacing = getEqualSpacingSnap(moving, others, threshold)
    if (!snapX && equalSpacing.dx !== 0) x += equalSpacing.dx
    if (!snapY && equalSpacing.dy !== 0) y += equalSpacing.dy
    moving = boundsOf(movingCard, x, y)
  }

  const guides = []
  if (snapX) {
    guides.push({
      axis: 'x',
      x: snapX.coordinate,
      y1: Math.min(moving.top, snapX.other.top) - 16,
      y2: Math.max(moving.bottom, snapX.other.bottom) + 16,
    })
  }
  if (snapY) {
    guides.push({
      axis: 'y',
      y: snapY.coordinate,
      x1: Math.min(moving.left, snapY.other.left) - 16,
      x2: Math.max(moving.right, snapY.other.right) + 16,
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
  boardId,
  cards,
  connectors,
  statusOptions,
  assigneeOptions,
  tagOptions,
  selectedIds,
  onSelect,

  onOpenDetail,
  onCloseDetail,
  onCreateCard,
  onUpdateCard,
  onDeleteCard,
  onCreateConnector,
  onUpdateConnector,
  onDeleteConnector,
  objectClipboard,
  onObjectClipboardChange,
  boardAppearance = 'dotted',
  tool,
  setTool,
  focusRequest,
}) {
  const containerRef = useRef(null)
  const lastPointerWorldRef = useRef(null)
  const pendingObjectPasteRef = useRef(null)
  const focusAnimRef = useRef(null)
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 })
  const [panning, setPanning] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [snapVisual, setSnapVisual] = useState(null)
  const [linking, setLinking] = useState(null) // { sourceId, sourceSide, x, y }
  const [hoveredCardId, setHoveredCardId] = useState(null)
  const [selectedConnectorId, setSelectedConnectorId] = useState(null)
  const [searchPulseId, setSearchPulseId] = useState(null)
  // Link-handle hover: { sourceId, side } | null. Drives the ghost preview.
  const [linkHover, setLinkHover] = useState(null)
  const linkHoverHideTimerRef = useRef(null)

  const cardsById = useMemo(() => {
    const m = {}
    cards.forEach((c) => (m[c.id] = c))
    return m
  }, [cards])

  // Fast membership check for the selected set during render.
  const selectedIdSet = useMemo(
    () => new Set(selectedIds || []),
    [selectedIds],
  )
  // Primary selection — the last id in the array. Used for surfaces that
  // only operate on a single card (resize, link drag, ghost preview,
  // detail-open) so multi-select doesn't break their semantics.
  const primarySelectedId =
    selectedIds && selectedIds.length ? selectedIds[selectedIds.length - 1] : null

  // Smoothly animate the view (pan + zoom) so the requested card is centred
  // in the viewport. Triggered by `focusRequest.token` bumps from the search bar.
  // Uses requestAnimationFrame when the tab is visible (smooth) and falls
  // back to setTimeout when hidden (so headless / background tab still pans).
  useEffect(() => {
    if (!focusRequest?.id) return
    const card = cardsById[focusRequest.id]
    const container = containerRef.current
    if (!card || !container) return

    const rect = container.getBoundingClientRect()
    // Choose a target zoom: don't shrink the view, but cap at 1.4 so the
    // card doesn't jump to fullscreen when navigating.
    const targetZoom = Math.min(1.4, Math.max(view.zoom, 1))
    const cardCenterX = card.x + card.width / 2
    const cardCenterY = card.y + card.height / 2
    const targetView = {
      zoom: targetZoom,
      x: rect.width / 2 - cardCenterX * targetZoom,
      y: rect.height / 2 - cardCenterY * targetZoom,
    }

    // Cancel any in-flight animation
    if (focusAnimRef.current) {
      if (typeof focusAnimRef.current === 'object') {
        clearTimeout(focusAnimRef.current.timer)
      } else {
        cancelAnimationFrame(focusAnimRef.current)
      }
      focusAnimRef.current = null
    }

    const startView = { ...view }
    const start = performance.now()
    const duration = 480
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

    const useRaf = !document.hidden

    const step = (now) => {
      const ts = now ?? performance.now()
      const t = Math.min(1, (ts - start) / duration)
      const e = ease(t)
      setView({
        zoom: startView.zoom + (targetView.zoom - startView.zoom) * e,
        x:    startView.x    + (targetView.x    - startView.x)    * e,
        y:    startView.y    + (targetView.y    - startView.y)    * e,
      })
      if (t < 1) {
        if (useRaf) {
          focusAnimRef.current = requestAnimationFrame(step)
        } else {
          const timer = setTimeout(() => step(performance.now()), 16)
          focusAnimRef.current = { timer }
        }
      } else {
        focusAnimRef.current = null
      }
    }
    if (useRaf) {
      focusAnimRef.current = requestAnimationFrame(step)
    } else {
      const timer = setTimeout(() => step(performance.now()), 16)
      focusAnimRef.current = { timer }
    }

    // Pulse-highlight the card briefly on arrival
    setSearchPulseId(focusRequest.id)
    const pulseTimer = setTimeout(() => setSearchPulseId((cur) => (cur === focusRequest.id ? null : cur)), 1400)

    return () => {
      if (focusAnimRef.current) {
        if (typeof focusAnimRef.current === 'object') clearTimeout(focusAnimRef.current.timer)
        else cancelAnimationFrame(focusAnimRef.current)
        focusAnimRef.current = null
      }
      clearTimeout(pulseTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.token])

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
      const segs = getPathSegmentsWithWaypoints(S, T, shape, conn.waypoints || [], { x: WORLD_OFFSET, y: WORLD_OFFSET })
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

  const getViewportCenterWorld = () => {
    const rect = containerRef.current.getBoundingClientRect()
    return screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2)
  }

  const getPasteWorldPoint = () => lastPointerWorldRef.current || getViewportCenterWorld()

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
    lastPointerWorldRef.current = screenToWorld(e.clientX, e.clientY)
    const isEmpty = e.target === containerRef.current || e.target.classList.contains('canvas-grid')
    if (e.button === 1 || (e.button === 0 && e.altKey) || (e.button === 0 && isEmpty && tool === 'select' && !linking)) {
      setPanning({ x: e.clientX, y: e.clientY, vx: view.x, vy: view.y })
      setSelectedConnectorId(null)
      // Clicking blank canvas clears the multi-select. Shift-clicking
      // blank canvas keeps the selection (matches Miro/Figma).
      if (!e.shiftKey) {
        onSelect([])
        onCloseDetail?.()
      }
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
        'card-table':      { node_shape: 'table',         w: 320, h: 132, title: '',         color: '#ffffff' },
      }
      const { node_shape, w, h, title, color } = shapeMap[tool] || shapeMap['card']
      const overrides = { node_shape, width: w, height: h, title, color }
      // Seed the table with a default 2 × 2 schema so the rendering branch
      // has something to display straight away.
      if (node_shape === 'table') {
        overrides.description = {
          table: {
            headers: ['Column 1', 'Column 2'],
            rows: [['', ''], ['', '']],
          },
        }
      }
      onCreateCard(x - w / 2, y - h / 2, overrides)
      setTool('select')
    }
  }

  const onMouseMove = (e) => {
    lastPointerWorldRef.current = screenToWorld(e.clientX, e.clientY)
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
      const draggedSet = dragging.cards
      // Multi-card drag: move every captured card by the cursor delta from
      // its individually recorded offset; preserves relative spacing.
      // Snap guides are only meaningful when a single card is moving — for
      // multi-drag we skip snap entirely (and clear any stale guides).
      if (draggedSet.length > 1) {
        if (snapVisual) setSnapVisual(null)
        for (const d of draggedSet) {
          const c = cardsById[d.id]
          if (!c) continue
          onUpdateCard(d.id, { x: x - d.offsetX, y: y - d.offsetY })
        }
        return
      }
      const single = draggedSet[0]
      const movingCard = cardsById[single.id]
      if (!movingCard) return
      const snap = getSnapResult({
        cards,
        movingCard,
        draftX: x - single.offsetX,
        draftY: y - single.offsetY,
        zoom: view.zoom,
      })
      // Only update snap state when there's something to show (or to clear) —
      // skipping no-op updates avoids re-rendering all cards 60×/sec.
      const hasSnap = snap.visual.guides.length > 0 || snap.visual.measurements.length > 0
      setSnapVisual((prev) => {
        if (!hasSnap) return prev ? null : prev
        return snap.visual
      })
      onUpdateCard(single.id, {
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

      // Drop target detection: pass 1 = exact AABB hit, pass 2 = padded hit
      // (the padded zone covers the link-handle area that sits outside the
      // card box, so dropping on a target's visible handle still resolves
      // to that target). Pass 3 falls back to "nearest card within reach"
      // so a near-miss still completes the connection.
      const candidates = cards.filter((c) => c.id !== linking.sourceId)
      const HANDLE_PAD = 28 // a little more than the 22px handle outset

      let target = candidates.find(
        (c) => x >= c.x && x <= c.x + c.width && y >= c.y && y <= c.y + c.height,
      )
      if (!target) {
        target = candidates.find(
          (c) =>
            x >= c.x - HANDLE_PAD &&
            x <= c.x + c.width + HANDLE_PAD &&
            y >= c.y - HANDLE_PAD &&
            y <= c.y + c.height + HANDLE_PAD,
        )
      }
      if (!target) {
        // Nearest-card fallback within a generous reach (helps near-misses)
        const REACH = 48
        let bestDist = Infinity
        for (const c of candidates) {
          const cx = c.x + c.width / 2
          const cy = c.y + c.height / 2
          const dxToBox = Math.max(c.x - x, 0, x - (c.x + c.width))
          const dyToBox = Math.max(c.y - y, 0, y - (c.y + c.height))
          const edgeDist = Math.hypot(dxToBox, dyToBox)
          if (edgeDist <= REACH && edgeDist < bestDist) {
            bestDist = edgeDist
            target = c
          }
        }
      }

      if (target) {
        // Prefer the side whose handle the user actually released on
        // (when DOM target is a link-handle of the target card).
        let targetSide = null
        const handleEl = e.target?.closest?.('.link-handle')
        if (handleEl) {
          const sideClass = ['top', 'right', 'bottom', 'left'].find((s) =>
            handleEl.classList.contains(s),
          )
          if (sideClass) targetSide = sideClass
        }
        if (!targetSide) {
          // Geometric fallback: side closest to drop point
          const tCenter = rectCenter(target)
          const dx = x - tCenter.x
          const dy = y - tCenter.y
          if (Math.abs(dx) * target.height >= Math.abs(dy) * target.width) {
            targetSide = dx >= 0 ? 'right' : 'left'
          } else {
            targetSide = dy >= 0 ? 'bottom' : 'top'
          }
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
    const pasteCopiedObjects = async () => {
      const copiedCards = objectClipboard?.cards || []
      if (!copiedCards.length) return
      // Same-board paste behaves like Miro: each paste steps the group down
      // and right. Cross-board paste lands at the cursor/viewport center while
      // preserving the copied group's relative layout.
      const firstCard = copiedCards[0].data
      const sourceAnchorX = firstCard.x ?? getPasteWorldPoint().x
      const sourceAnchorY = firstCard.y ?? getPasteWorldPoint().y
      const pastePoint = getPasteWorldPoint()
      const sameBoard = objectClipboard?.sourceBoardId === boardId
      const pasteOriginX = sameBoard ? sourceAnchorX + PASTE_OFFSET : pastePoint.x
      const pasteOriginY = sameBoard ? sourceAnchorY + PASTE_OFFSET : pastePoint.y
      const deltaX = pasteOriginX - sourceAnchorX
      const deltaY = pasteOriginY - sourceAnchorY
      const newCards = []
      const newIds = []
      const idMap = new Map()
      for (const item of copiedCards) {
        const c = item.data
        const nx = (c.x ?? sourceAnchorX) + deltaX
        const ny = (c.y ?? sourceAnchorY) + deltaY
        const created = await onCreateCard(nx, ny, {
          ...cloneCardForPaste(c),
          x: nx,
          y: ny,
          title: c.title || 'Copy',
        })
        if (created) {
          newCards.push(created)
          newIds.push(created.id)
          idMap.set(item.sourceId, created.id)
        }
      }

      const newConnectors = []
      for (const item of objectClipboard?.connectors || []) {
        const sourceId = idMap.get(item.sourceCardId)
        const targetId = idMap.get(item.targetCardId)
        if (!sourceId || !targetId) continue
        const opts = cloneClipboardData(item.data)
        if (Array.isArray(opts.waypoints)) {
          opts.waypoints = opts.waypoints.map((point) => ({
            ...point,
            x: (point.x ?? 0) + deltaX,
            y: (point.y ?? 0) + deltaY,
          }))
        }
        const created = await onCreateConnector(sourceId, targetId, opts)
        if (created) newConnectors.push(created)
      }

      // Re-arm the buffer with the freshly-pasted objects so a second Cmd+V
      // produces another batch offset further down/right on this board.
      if (newCards.length) {
        onObjectClipboardChange(createBoardClipboardPayload(boardId, newCards, newConnectors))
        // Select the freshly-pasted set so user can immediately drag/edit.
        onSelect(newIds)
      }
    }
    const pasteImageFile = async (file) => {
      const src = await readFileAsDataUrl(file)
      const dimensions = await getImageDimensions(src)
      const size = fitImageSize(dimensions.width, dimensions.height)
      const point = getPasteWorldPoint()
      await onCreateCard(point.x - size.width / 2, point.y - size.height / 2, {
        node_shape: 'image',
        title: file.name || 'Pasted image',
        color: '#ffffff',
        width: size.width,
        height: size.height,
        description: {
          image: {
            src,
            name: file.name || 'Pasted image',
            type: file.type || 'image/png',
          },
        },
      })
    }
    const onKey = (e) => {
      const commandKey = e.metaKey || e.ctrlKey
      if (commandKey && (e.key === 'c' || e.key === 'C')) {
        if (isTyping(e.target)) return
        // Cmd/Ctrl+C copies EVERY card currently in the multi-selection.
        const sel = (selectedIds || []).map((id) => cardsById[id]).filter(Boolean)
        if (sel.length) {
          e.preventDefault()
          onObjectClipboardChange(createBoardClipboardPayload(boardId, sel, connectors))
        }
        return
      }
      if (commandKey && (e.key === 'v' || e.key === 'V')) {
        if (isTyping(e.target)) return
        if (objectClipboard?.cards?.length) {
          if (pendingObjectPasteRef.current) clearTimeout(pendingObjectPasteRef.current)
          pendingObjectPasteRef.current = setTimeout(() => {
            pendingObjectPasteRef.current = null
            pasteCopiedObjects().catch((error) => console.error(error))
          }, 0)
        }
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isTyping(e.target)) return
        // Delete every selected card (multi). Connector takes precedence
        // only when no card is selected.
        if ((selectedIds || []).length) {
          for (const id of selectedIds) onDeleteCard(id)
        } else if (selectedConnectorId) {
          onDeleteConnector(selectedConnectorId)
          setSelectedConnectorId(null)
        }
      }
      if (e.key === 'Escape') {
        onSelect([])
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
    const onPaste = (e) => {
      if (isTyping(e.target)) return
      const imageItem = Array.from(e.clipboardData?.items || []).find((item) =>
        item.kind === 'file' && item.type.startsWith('image/'),
      )
      const file = imageItem?.getAsFile()
      if (!file) return
      if (pendingObjectPasteRef.current) {
        clearTimeout(pendingObjectPasteRef.current)
        pendingObjectPasteRef.current = null
      }
      e.preventDefault()
      pasteImageFile(file).catch((error) => console.error(error))
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('paste', onPaste)
      if (pendingObjectPasteRef.current) clearTimeout(pendingObjectPasteRef.current)
    }
  }, [
    boardId,
    selectedIds,
    selectedConnectorId,
    cardsById,
    connectors,
    objectClipboard,
    onCreateCard,
    onCreateConnector,
    onDeleteCard,
    onDeleteConnector,
    onObjectClipboardChange,
    onSelect,
    setTool,
    tool,
    view,
  ])

  const startDrag = (e, card) => {
    e.stopPropagation()
    setSelectedConnectorId(null)

    // Resolve the next selection set from the click + shift-key combo.
    let nextSelected
    if (e.shiftKey) {
      // Shift-click → toggle this card's membership in the selection
      // and DON'T begin a drag (matches Miro / Figma).
      onSelect((prev) =>
        (prev || []).includes(card.id)
          ? prev.filter((x) => x !== card.id)
          : [...(prev || []), card.id],
      )
      return
    } else if ((selectedIds || []).includes(card.id)) {
      // Already part of the multi-selection → keep selection, drag all.
      nextSelected = selectedIds
    } else {
      // Plain click → replace with single-card selection.
      nextSelected = [card.id]
      onSelect(nextSelected)
    }

    const { x, y } = screenToWorld(e.clientX, e.clientY)
    // Capture each dragged card's offset from the cursor so they all move
    // together while preserving their relative positions.
    const cardsToDrag = nextSelected
      .map((id) => cardsById[id])
      .filter(Boolean)
      .map((c) => ({ id: c.id, offsetX: x - c.x, offsetY: y - c.y }))
    setDragging({
      primaryId: card.id,
      cards: cardsToDrag.length ? cardsToDrag : [{ id: card.id, offsetX: x - card.x, offsetY: y - card.y }],
    })
  }

  const startLink = (e, card, side) => {
    e.stopPropagation()
    const { x, y } = screenToWorld(e.clientX, e.clientY)
    setLinking({ sourceId: card.id, sourceSide: side, x, y })
    // Hide ghost the moment a real link drag begins.
    setLinkHover(null)
  }

  // Link-handle hover handlers. A short delay before hiding gives the
  // pointer time to travel from the handle onto the ghost (and the ghost's
  // own enter/leave keep it alive while pointer is over it).
  const showLinkGhost = (cardId, side) => {
    if (linking || dragging || panning) return
    if (linkHoverHideTimerRef.current) {
      clearTimeout(linkHoverHideTimerRef.current)
      linkHoverHideTimerRef.current = null
    }
    setLinkHover({ sourceId: cardId, side })
  }
  const hideLinkGhostSoon = () => {
    if (linkHoverHideTimerRef.current) clearTimeout(linkHoverHideTimerRef.current)
    linkHoverHideTimerRef.current = setTimeout(() => {
      setLinkHover(null)
      linkHoverHideTimerRef.current = null
    }, 140)
  }

  // Click on the ghost → spawn a real card with the same shape & a connector.
  const commitGhost = async (e) => {
    e.stopPropagation()
    if (!linkHover) return
    const src = cardsById[linkHover.sourceId]
    if (!src) return
    const pos = computeGhostPosition(src, linkHover.side, cards)
    const isRect = (src.node_shape || 'rect') === 'rect'
    const overrides = {
      node_shape: src.node_shape || 'rect',
      width:  pos.width,
      height: pos.height,
      color:  src.color,
      title:  isRect ? 'New card' : '',
      color_bar_style: src.color_bar_style,
    }
    setLinkHover(null)
    const created = await onCreateCard(pos.x, pos.y, overrides)
    if (created) {
      await onCreateConnector(src.id, created.id, {
        source_side: linkHover.side,
        target_side: GHOST_OPPOSITE[linkHover.side],
      })
      onSelect([created.id])
    }
  }

  // Hide ghost + clear timer if any of the gestures take over.
  useEffect(() => {
    if ((linking || dragging || panning) && linkHover) setLinkHover(null)
  }, [linking, dragging, panning, linkHover])

  // Compute toolbar position for selected connector
  const selectedConnector = selectedConnectorId
    ? connectors.find((c) => c.id === selectedConnectorId)
    : null
  const bugsConnectorIds = useMemo(
    () => collectBugsFlowConnectorIds(cards, connectors),
    [cards, connectors],
  )
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
        className={`canvas-grid ${boardAppearance === 'clear' ? 'clear' : 'dotted'}`}
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
                bugsAffected={bugsConnectorIds.has(conn.id)}
                crossingSegments={crossings}
                onSelect={() => {
                  setSelectedConnectorId(conn.id)
                  onSelect([])
                }}
                onUpdateWaypoints={(waypoints) =>
                  onUpdateConnector(conn.id, { waypoints })
                }
                onUpdateLabel={(patch) =>
                  onUpdateConnector(conn.id, patch)
                }
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

          {/* Ghost connector linking source to the ghost card preview */}
          {linkHover && cardsById[linkHover.sourceId] && (() => {
            const src = cardsById[linkHover.sourceId]
            const pos = computeGhostPosition(src, linkHover.side, cards)
            const ghostTarget = { ...src, id: '__ghost__', x: pos.x, y: pos.y, width: pos.width, height: pos.height }
            return (
              <Connector
                source={src}
                target={ghostTarget}
                offset={{ x: WORLD_OFFSET, y: WORLD_OFFSET }}
                ghost
                conn={{
                  source_side: linkHover.side,
                  target_side: GHOST_OPPOSITE[linkHover.side],
                }}
              />
            )
          })()}
        </svg>

        {cards.map((card) => (
          <CardNode
            key={card.id}
            card={card}
            selected={selectedIdSet.has(card.id)}
            hovered={hoveredCardId === card.id}
            linkTarget={!!linking && linking.sourceId !== card.id}
            searchPulse={searchPulseId === card.id}
            onMouseDown={(e) => startDrag(e, card)}
            onDoubleClick={() => {
              if (isDetailCard(card)) onOpenDetail(card.id)
            }}
            onMouseEnter={() => setHoveredCardId(card.id)}
            onMouseLeave={() => setHoveredCardId(null)}
            onStartLink={(e, side) => startLink(e, card, side)}
            onHoverLinkHandle={(side) =>
              side ? showLinkGhost(card.id, side) : hideLinkGhostSoon()
            }
            onResize={(w, h) => onUpdateCard(card.id, { width: w, height: h })}
            onTitleChange={(t) => onUpdateCard(card.id, { title: t })}
            onDescriptionChange={(patch) =>
              onUpdateCard(card.id, {
                description: { ...(card.description || {}), ...patch },
              })
            }
            onColorChange={(color) => onUpdateCard(card.id, { color })}
            statusOptions={statusOptions}
            assigneeOptions={assigneeOptions}
            tagOptions={tagOptions}
          />
        ))}

        {/* ── Ghost suggestion (hovered link-handle) ────────────────────── */}
        {linkHover && cardsById[linkHover.sourceId] && (() => {
          const src = cardsById[linkHover.sourceId]
          const pos = computeGhostPosition(src, linkHover.side, cards)
          const ghostCard = {
            ...src,
            id: '__ghost__',
            x: pos.x,
            y: pos.y,
            width: pos.width,
            height: pos.height,
            title: '',
            description: null,
          }
          return (
            <>
              <CardNode
                key="__ghost__"
                card={ghostCard}
                ghost
                onMouseDown={commitGhost}
                onMouseEnter={() => {
                  // Cancel the pending hide so ghost stays alive while hovered.
                  if (linkHoverHideTimerRef.current) {
                    clearTimeout(linkHoverHideTimerRef.current)
                    linkHoverHideTimerRef.current = null
                  }
                }}
                onMouseLeave={hideLinkGhostSoon}
                statusOptions={statusOptions}
                assigneeOptions={assigneeOptions}
                tagOptions={tagOptions}
              />
              <div
                className="ghost-plus"
                style={{
                  position: 'absolute',
                  left: ghostCard.x,
                  top: ghostCard.y,
                  width: ghostCard.width,
                  height: ghostCard.height,
                }}
              >
                <span>+ Add</span>
              </div>
            </>
          )
        })()}

        {snapVisual && <SnapGuides visual={snapVisual} offset={WORLD_OFFSET} zoom={view.zoom} />}
      </div>

      {selectedConnector && toolbarPos && (
        <ConnectorToolbar
          connector={selectedConnector}
          screenX={toolbarPos.x}
          screenY={toolbarPos.y}
          onUpdate={(patch) => onUpdateConnector(selectedConnector.id, patch)}
          onAddLabel={() => {
            const src = cardsById[selectedConnector.source_card_id]
            const tgt = cardsById[selectedConnector.target_card_id]
            if (!src || !tgt) return
            const sAnchor = pickAnchor(src, rectCenter(tgt), selectedConnector.source_side)
            const tAnchor = pickAnchor(tgt, rectCenter(src), selectedConnector.target_side)
            onUpdateConnector(selectedConnector.id, {
              label_text: 'Text',
              label_x: (sAnchor.x + tAnchor.x) / 2 - 84,
              label_y: (sAnchor.y + tAnchor.y) / 2 - 18,
            })
          }}
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
