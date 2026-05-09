import { useEffect, useId, useState } from 'react'
import { BUGS_STATUS_COLOR } from '../lib/status'

const LABEL_W = 168
const LABEL_H = 36

// ── Pure geometry helpers ────────────────────────────────────────────────────

export function rectCenter(r) {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}

export function pickAnchor(rect, otherCenter, forcedSide) {
  const c = rectCenter(rect)
  let side = forcedSide
  if (!side) {
    const dx = otherCenter.x - c.x
    const dy = otherCenter.y - c.y
    if (Math.abs(dx) * rect.height >= Math.abs(dy) * rect.width) {
      side = dx >= 0 ? 'right' : 'left'
    } else {
      side = dy >= 0 ? 'bottom' : 'top'
    }
  }
  switch (side) {
    case 'right':  return { x: rect.x + rect.width, y: c.y, side }
    case 'left':   return { x: rect.x, y: c.y, side }
    case 'top':    return { x: c.x, y: rect.y, side }
    case 'bottom':
    default:       return { x: c.x, y: rect.y + rect.height, side: 'bottom' }
  }
}

function isHorizontal(side) {
  return side === 'left' || side === 'right'
}

// ── Path segment builders ────────────────────────────────────────────────────

/**
 * Returns [[from, to], …] segments for the connector's default auto-routing.
 * Exported for use in Canvas.jsx's line-jump intersection tests.
 */
export function getPathSegments(s, t, shape) {
  if (shape === 'straight') return [[s, t]]
  if (shape === 'rounded')  return getPathSegments(s, t, 'orthogonal')
  if (shape === 'orthogonal') {
    const sH = isHorizontal(s.side)
    const tH = isHorizontal(t.side)
    if (sH && tH) {
      const midX = (s.x + t.x) / 2
      return [
        [s,                     { x: midX, y: s.y }],
        [{ x: midX, y: s.y },  { x: midX, y: t.y }],
        [{ x: midX, y: t.y },  t],
      ]
    }
    if (!sH && !tH) {
      const midY = (s.y + t.y) / 2
      return [
        [s,                     { x: s.x, y: midY }],
        [{ x: s.x, y: midY },  { x: t.x, y: midY }],
        [{ x: t.x, y: midY },  t],
      ]
    }
    if (sH && !tH) return [[s, { x: t.x, y: s.y }], [{ x: t.x, y: s.y }, t]]
    return [[s, { x: s.x, y: t.y }], [{ x: s.x, y: t.y }, t]]
  }
  return []
}

/**
 * Like getPathSegments but respects stored waypoints (world coords).
 * S and T must already be in SVG offset-coordinate space.
 * offset = { x: WORLD_OFFSET, y: WORLD_OFFSET } is applied to waypoints.
 */
export function getPathSegmentsWithWaypoints(S, T, shape, waypoints, offset = { x: 0, y: 0 }) {
  if (!waypoints?.length) return getPathSegments(S, T, shape)

  if (shape === 'straight') {
    const pts = [S, ...waypoints.map((wp) => ({ x: wp.x + offset.x, y: wp.y + offset.y })), T]
    return pts.slice(0, -1).map((p, i) => [p, pts[i + 1]])
  }

  if (shape === 'orthogonal' || shape === 'rounded') {
    const sH = isHorizontal(S.side)
    const tH = isHorizontal(T.side)
    if (sH && tH && waypoints[0] != null) {
      const midX = waypoints[0].x + offset.x
      return [
        [S,                     { x: midX, y: S.y }],
        [{ x: midX, y: S.y },  { x: midX, y: T.y }],
        [{ x: midX, y: T.y },  T],
      ]
    }
    if (!sH && !tH && waypoints[0] != null) {
      const midY = waypoints[0].y + offset.y
      return [
        [S,                     { x: S.x, y: midY }],
        [{ x: S.x, y: midY },  { x: T.x, y: midY }],
        [{ x: T.x, y: midY },  T],
      ]
    }
  }

  return getPathSegments(S, T, shape)
}

// ── Path string builders ─────────────────────────────────────────────────────

function buildRoundedPathFromSegs(segs) {
  if (!segs.length) return ''
  const R = 14
  const pts = [segs[0][0], ...segs.map(([, b]) => b)]
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]
    const curr = pts[i]
    if (i === pts.length - 1) {
      d += ` L ${curr.x} ${curr.y}`
    } else {
      const next = pts[i + 1]
      const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y
      const dx2 = next.x - curr.x, dy2 = next.y - curr.y
      const len1 = Math.hypot(dx1, dy1), len2 = Math.hypot(dx2, dy2)
      if (len1 < 1 || len2 < 1) { d += ` L ${curr.x} ${curr.y}`; continue }
      const r = Math.min(R, len1 * 0.45, len2 * 0.45)
      const ux1 = dx1 / len1, uy1 = dy1 / len1
      const ux2 = dx2 / len2, uy2 = dy2 / len2
      const bx = curr.x - ux1 * r, by = curr.y - uy1 * r
      const ax = curr.x + ux2 * r, ay = curr.y + uy2 * r
      const sweep = (ux1 * uy2 - uy1 * ux2) > 0 ? 1 : 0
      d += ` L ${bx} ${by} A ${r} ${r} 0 0 ${sweep} ${ax} ${ay}`
    }
  }
  return d
}

function roundedPath(S, T, waypoints, offset) {
  const segs = getPathSegmentsWithWaypoints(S, T, 'orthogonal', waypoints, offset)
  return buildRoundedPathFromSegs(segs)
}

function curvedPath(S, T, waypoints, offset) {
  const sH = isHorizontal(S.side)
  const tH = isHorizontal(T.side)
  const dist = Math.max(40, Math.hypot(T.x - S.x, T.y - S.y) * 0.4)

  let c1, c2
  if (waypoints?.[0] != null) {
    c1 = { x: waypoints[0].x + offset.x, y: waypoints[0].y + offset.y }
  } else {
    c1 = sH
      ? { x: S.x + (S.side === 'right' ? dist : -dist), y: S.y }
      : { x: S.x, y: S.y + (S.side === 'bottom' ? dist : -dist) }
  }
  if (waypoints?.[1] != null) {
    c2 = { x: waypoints[1].x + offset.x, y: waypoints[1].y + offset.y }
  } else {
    c2 = tH
      ? { x: T.x + (T.side === 'right' ? dist : -dist), y: T.y }
      : { x: T.x, y: T.y + (T.side === 'bottom' ? dist : -dist) }
  }

  return `M ${S.x} ${S.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${T.x} ${T.y}`
}

// ── Line-jump helpers ────────────────────────────────────────────────────────

function segmentIntersect(p1, p2, p3, p4) {
  const x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y
  const x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(denom) < 1e-6) return null
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom
  if (t > 0.05 && t < 0.95 && u > 0.05 && u < 0.95) {
    return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) }
  }
  return null
}

function buildPathWithJumps(segments, otherSegments, radius = 6) {
  if (!segments.length) return ''
  let d = `M ${segments[0][0].x} ${segments[0][0].y}`
  for (const [a, b] of segments) {
    if (!otherSegments?.length) { d += ` L ${b.x} ${b.y}`; continue }
    const intersections = []
    for (const seg of otherSegments) {
      const p = segmentIntersect(a, b, seg.a, seg.b)
      if (p) intersections.push(p)
    }
    if (!intersections.length) { d += ` L ${b.x} ${b.y}`; continue }
    const dx = b.x - a.x, dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    if (len < radius * 2.5) { d += ` L ${b.x} ${b.y}`; continue }
    const ux = dx / len, uy = dy / len
    const filtered = intersections.filter((p) => {
      const tt = (p.x - a.x) * ux + (p.y - a.y) * uy
      return tt > radius * 1.2 && tt < len - radius * 1.2
    })
    filtered.sort((p1, p2) => {
      const t1 = (p1.x - a.x) * ux + (p1.y - a.y) * uy
      const t2 = (p2.x - a.x) * ux + (p2.y - a.y) * uy
      return t1 - t2
    })
    for (const p of filtered) {
      const before = { x: p.x - ux * radius, y: p.y - uy * radius }
      const after  = { x: p.x + ux * radius, y: p.y + uy * radius }
      d += ` L ${before.x} ${before.y}`
      d += ` A ${radius} ${radius} 0 0 1 ${after.x} ${after.y}`
    }
    d += ` L ${b.x} ${b.y}`
  }
  return d
}

function buildPlainPath(segments) {
  if (!segments.length) return ''
  let d = `M ${segments[0][0].x} ${segments[0][0].y}`
  for (const [, b] of segments) d += ` L ${b.x} ${b.y}`
  return d
}

function dashArray(style, thickness) {
  if (style === 'dashed') return `${thickness * 4} ${thickness * 3}`
  if (style === 'dotted') return `${thickness} ${thickness * 2}`
  return undefined
}

// ── Bone computation ─────────────────────────────────────────────────────────
//
// Each bone describes a draggable control point. Fields:
//   svgX / svgY      – position in SVG coordinate space (offset-corrected)
//   worldX / worldY  – position in world space (what gets stored in DB)
//   constraint       – 'both' | 'x' (drag only horizontal) | 'y' (drag only vertical)
//   waypointIndex    – index into conn.waypoints[]
//   isVirtual        – true when no waypoint is stored yet (shown at default pos)

function getBoneInfos(S, T, shape, waypoints, offset) {
  const bones = []

  // ── Straight ──────────────────────────────────────────────────────────────
  if (shape === 'straight') {
    if (waypoints?.length) {
      for (let i = 0; i < waypoints.length; i++) {
        const svgX = waypoints[i].x + offset.x
        const svgY = waypoints[i].y + offset.y
        bones.push({ svgX, svgY, worldX: waypoints[i].x, worldY: waypoints[i].y, constraint: 'both', waypointIndex: i, isVirtual: false })
      }
    } else {
      // Virtual: midpoint of the line
      const svgX = (S.x + T.x) / 2
      const svgY = (S.y + T.y) / 2
      bones.push({ svgX, svgY, worldX: svgX - offset.x, worldY: svgY - offset.y, constraint: 'both', waypointIndex: 0, isVirtual: true })
    }
    return bones
  }

  // ── Orthogonal / Rounded ──────────────────────────────────────────────────
  if (shape === 'orthogonal' || shape === 'rounded') {
    const sH = isHorizontal(S.side)
    const tH = isHorizontal(T.side)

    if (sH && tH) {
      // 3-segment path; bone sits on the middle vertical segment (drag X-axis)
      const midX  = waypoints?.[0] != null ? waypoints[0].x + offset.x : (S.x + T.x) / 2
      const svgY  = (S.y + T.y) / 2   // vertical midpoint of the middle segment
      bones.push({
        svgX: midX, svgY,
        worldX: midX - offset.x, worldY: svgY - offset.y,
        constraint: 'x',
        waypointIndex: 0,
        isVirtual: !waypoints?.length,
      })
    } else if (!sH && !tH) {
      // 3-segment path; bone sits on the middle horizontal segment (drag Y-axis)
      const midY  = waypoints?.[0] != null ? waypoints[0].y + offset.y : (S.y + T.y) / 2
      const svgX  = (S.x + T.x) / 2   // horizontal midpoint of the middle segment
      bones.push({
        svgX, svgY: midY,
        worldX: svgX - offset.x, worldY: midY - offset.y,
        constraint: 'y',
        waypointIndex: 0,
        isVirtual: !waypoints?.length,
      })
    }
    // H-V and V-H cases: fixed corner — no free bone needed
    return bones
  }

  // ── Curved ────────────────────────────────────────────────────────────────
  if (shape === 'curved') {
    const sH = isHorizontal(S.side)
    const tH = isHorizontal(T.side)
    const dist = Math.max(40, Math.hypot(T.x - S.x, T.y - S.y) * 0.4)

    const defC1svgX = sH ? S.x + (S.side === 'right' ?  dist : -dist) : S.x
    const defC1svgY = sH ? S.y                                          : S.y + (S.side === 'bottom' ? dist : -dist)
    const defC2svgX = tH ? T.x + (T.side === 'right' ?  dist : -dist) : T.x
    const defC2svgY = tH ? T.y                                          : T.y + (T.side === 'bottom' ? dist : -dist)

    const c1x = waypoints?.[0] != null ? waypoints[0].x + offset.x : defC1svgX
    const c1y = waypoints?.[0] != null ? waypoints[0].y + offset.y : defC1svgY
    const c2x = waypoints?.[1] != null ? waypoints[1].x + offset.x : defC2svgX
    const c2y = waypoints?.[1] != null ? waypoints[1].y + offset.y : defC2svgY

    bones.push({ svgX: c1x, svgY: c1y, worldX: c1x - offset.x, worldY: c1y - offset.y, constraint: 'both', waypointIndex: 0, isVirtual: !waypoints?.[0] })
    bones.push({ svgX: c2x, svgY: c2y, worldX: c2x - offset.x, worldY: c2y - offset.y, constraint: 'both', waypointIndex: 1, isVirtual: !waypoints?.[1] })
  }

  return bones
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Connector({
  conn,
  source,
  target,
  targetPoint,
  offset = { x: 0, y: 0 },
  ghost = false,
  selected = false,
  onSelect,
  onUpdateWaypoints,
  onUpdateLabel,
  crossingSegments = [],
  bugsAffected = false,
}) {
  const uid = useId()
  const arrowId = `arrow-${uid}`
  const maskId = `connector-mask-${uid}`
  const [draggingBone, setDraggingBone] = useState(null)
  const [draggingLabel, setDraggingLabel] = useState(null)

  const sourceCenter = rectCenter(source)
  const targetCenter = target ? rectCenter(target) : targetPoint
  const s = pickAnchor(source, targetCenter, conn?.source_side)
  const t = target
    ? pickAnchor(target, sourceCenter, conn?.target_side)
    : { ...targetPoint, side: 'left' }

  const S = { ...s, x: s.x + offset.x, y: s.y + offset.y }
  const T = { ...t, x: t.x + offset.x, y: t.y + offset.y }

  const shape     = conn?.shape        || 'orthogonal'
  const style     = conn?.style        || 'solid'
  const thickness = conn?.thickness    ?? 2
  const arrowStart = conn?.arrow_start ?? false
  const arrowEnd   = conn?.arrow_end   ?? true
  const lineJumps  = conn?.line_jumps  ?? true
  const waypoints  = conn?.waypoints   || []
  const hasLabel = !ghost && conn?.label_text != null
  const defaultLabelX = ((S.x + T.x) / 2) - offset.x - LABEL_W / 2
  const defaultLabelY = ((S.y + T.y) / 2) - offset.y - LABEL_H / 2
  const labelX = conn?.label_x ?? defaultLabelX
  const labelY = conn?.label_y ?? defaultLabelY
  const labelSvgX = labelX + offset.x
  const labelSvgY = labelY + offset.y

  // ── Build path string ──────────────────────────────────────────────────────
  let d
  if (shape === 'curved') {
    d = curvedPath(S, T, waypoints, offset)
  } else if (shape === 'rounded' && !ghost) {
    d = roundedPath(S, T, waypoints, offset)
  } else {
    const effectiveWaypoints = ghost ? [] : waypoints
    const effectiveShape     = ghost ? 'straight' : shape
    const segments = getPathSegmentsWithWaypoints(S, T, effectiveShape, effectiveWaypoints, offset)
    d = !ghost && lineJumps
      ? buildPathWithJumps(segments, crossingSegments)
      : buildPlainPath(segments)
  }

  // ── Bone drag ─────────────────────────────────────────────────────────────
  // We capture the waypoints snapshot at drag-start so delta is applied
  // against the ORIGINAL position — no stale-closure issues.
  useEffect(() => {
    if (!draggingBone || !onUpdateWaypoints) return
    const {
      boneIndex, startClientX, startClientY,
      startWorldX, startWorldY,
      zoom, tx, ty,
      constraint, startWaypoints,
    } = draggingBone

    const onMove = (e) => {
      const dx = (e.clientX - startClientX) / zoom
      const dy = (e.clientY - startClientY) / zoom
      const newWorldX = startWorldX + dx
      const newWorldY = startWorldY + dy

      const next = [...startWaypoints]
      while (next.length <= boneIndex) next.push({ x: 0, y: 0 })

      if (constraint === 'x') {
        next[boneIndex] = { x: newWorldX, y: startWorldY }
      } else if (constraint === 'y') {
        next[boneIndex] = { x: startWorldX, y: newWorldY }
      } else {
        next[boneIndex] = { x: newWorldX, y: newWorldY }
      }

      onUpdateWaypoints(next)
    }

    const onUp = () => setDraggingBone(null)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [draggingBone, onUpdateWaypoints])

  useEffect(() => {
    if (!draggingLabel || !onUpdateLabel) return
    const { startClientX, startClientY, startX, startY, zoom } = draggingLabel

    const onMove = (e) => {
      const dx = (e.clientX - startClientX) / zoom
      const dy = (e.clientY - startClientY) / zoom
      onUpdateLabel({
        label_x: startX + dx,
        label_y: startY + dy,
      })
    }

    const onUp = () => setDraggingLabel(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [draggingLabel, onUpdateLabel])

  const handleBoneMouseDown = (e, bone) => {
    e.stopPropagation()
    e.preventDefault()
    // Read zoom + pan from the canvas-world transform matrix
    const svgEl      = e.currentTarget.closest('svg')
    const worldEl    = svgEl?.parentElement          // .canvas-world div
    const containerEl = worldEl?.parentElement        // .canvas div
    if (!worldEl || !containerEl) return

    const matrix = window.getComputedStyle(worldEl).transform
    const m = matrix.match(/matrix\(([^)]+)\)/)
    if (!m) return
    const parts = m[1].split(',').map(Number)
    const zoom = parts[0]
    const tx   = parts[4]
    const ty   = parts[5]

    setDraggingBone({
      boneIndex:      bone.waypointIndex,
      startClientX:   e.clientX,
      startClientY:   e.clientY,
      startWorldX:    bone.worldX,
      startWorldY:    bone.worldY,
      zoom, tx, ty,
      constraint:     bone.constraint,
      startWaypoints: [...waypoints],   // snapshot
    })
  }

  const readZoomFromEvent = (e) => {
    const svgEl = e.currentTarget.closest('svg')
    const worldEl = svgEl?.parentElement
    if (!worldEl) return 1
    const matrix = window.getComputedStyle(worldEl).transform
    const m = matrix.match(/matrix\(([^)]+)\)/)
    if (!m) return 1
    const parts = m[1].split(',').map(Number)
    return parts[0] || 1
  }

  const handleLabelDragMouseDown = (e) => {
    if (!onUpdateLabel) return
    e.stopPropagation()
    e.preventDefault()
    onSelect?.()
    setDraggingLabel({
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: labelX,
      startY: labelY,
      zoom: readZoomFromEvent(e),
    })
  }

  // ── Bones (visible only when selected & not ghost) ────────────────────────
  const bones = (selected && !ghost && onUpdateWaypoints)
    ? getBoneInfos(S, T, shape, waypoints, offset)
    : []

  const boneCursor = (c) => c === 'x' ? 'ew-resize' : c === 'y' ? 'ns-resize' : 'move'

  const showBugsAppearance = bugsAffected && !ghost
  const stroke      = showBugsAppearance ? BUGS_STATUS_COLOR : ghost ? '#9ca3af' : selected ? '#3b82f6' : '#1f2330'
  const strokeWidth = ghost ? 1.6 : thickness
  const dash        = showBugsAppearance ? `${thickness * 4} ${thickness * 2.5}` : dashArray(style, thickness)

  return (
    <g
      onMouseDown={(e) => {
        if (ghost) return
        e.stopPropagation()
        onSelect?.()
      }}
      style={{ cursor: ghost ? 'default' : 'pointer' }}
    >
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 10 10"
          refX="9" refY="5"
          markerWidth={Math.max(4, 7 - thickness * 0.4)}
          markerHeight={Math.max(4, 7 - thickness * 0.4)}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
        </marker>
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          {hasLabel && (
            <rect
              x={labelSvgX - 4}
              y={labelSvgY - 4}
              width={LABEL_W + 8}
              height={LABEL_H + 8}
              rx="8"
              fill="black"
            />
          )}
        </mask>
      </defs>

      {/* Wide invisible hit area */}
      {!ghost && (
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(14, thickness + 12)}
          className="connector-hit"
        />
      )}

      {/* Visible line */}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
        strokeLinecap="round"
        strokeLinejoin="round"
        markerStart={!ghost && arrowStart ? `url(#${arrowId})` : undefined}
        markerEnd={!ghost && arrowEnd ? `url(#${arrowId})` : undefined}
        mask={hasLabel ? `url(#${maskId})` : undefined}
        className={`connector-line${showBugsAppearance ? ' status-bugs' : ''}`}
      />

      {hasLabel && (
        <foreignObject
          x={labelSvgX}
          y={labelSvgY}
          width={LABEL_W}
          height={LABEL_H}
          className="connector-label-fo"
        >
          <div className={`connector-label${selected ? ' selected' : ''}`}>
            <button
              type="button"
              className="connector-label-grip"
              title="Move text"
              onMouseDown={handleLabelDragMouseDown}
            >
              <span />
              <span />
              <span />
            </button>
            <input
              className="connector-label-input"
              value={conn.label_text || ''}
              placeholder="Text"
              onMouseDown={(e) => {
                e.stopPropagation()
                onSelect?.()
              }}
              onChange={(e) => onUpdateLabel?.({ label_text: e.target.value })}
            />
          </div>
        </foreignObject>
      )}

      {/* ── Bezier guide lines (curved only) ─────────────────────────────── */}
      {shape === 'curved' && bones.map((bone, i) => {
        const endpoint = i === 0 ? S : T
        return (
          <line
            key={`cguide-${i}`}
            x1={endpoint.x} y1={endpoint.y}
            x2={bone.svgX}  y2={bone.svgY}
            stroke="#3b82f6"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.45}
            pointerEvents="none"
          />
        )
      })}

      {/* ── Bone circles ─────────────────────────────────────────────────── */}
      {bones.map((bone, i) => (
        <g key={`bone-${i}`} className="connector-bone">
          {/* Larger hit area for easy grabbing — explicit pointer-events: all
              overrides .connectors-layer { pointer-events: none } */}
          <circle
            cx={bone.svgX} cy={bone.svgY} r={10}
            fill="white"
            fillOpacity={0.001}
            style={{ cursor: boneCursor(bone.constraint), pointerEvents: 'all' }}
            onMouseDown={(e) => handleBoneMouseDown(e, bone)}
          />
          {/* Visible handle */}
          <circle
            cx={bone.svgX} cy={bone.svgY} r={5}
            fill="white"
            stroke="#3b82f6"
            strokeWidth={2}
            opacity={bone.isVirtual ? 0.6 : 1}
            style={{ pointerEvents: 'none' }}
          />
          {/* Inner dot for stored bones */}
          {!bone.isVirtual && (
            <circle
              cx={bone.svgX} cy={bone.svgY} r={2.5}
              fill="#3b82f6"
              style={{ pointerEvents: 'none' }}
            />
          )}
        </g>
      ))}
    </g>
  )
}
