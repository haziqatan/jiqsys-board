import { useId } from 'react'

function rectCenter(r) {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}

function pickAnchor(rect, otherCenter, forcedSide) {
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
    case 'right':
      return { x: rect.x + rect.width, y: c.y, side }
    case 'left':
      return { x: rect.x, y: c.y, side }
    case 'top':
      return { x: c.x, y: rect.y, side }
    case 'bottom':
    default:
      return { x: c.x, y: rect.y + rect.height, side: 'bottom' }
  }
}

function isHorizontal(side) {
  return side === 'left' || side === 'right'
}

// Returns an array of [from, to] line segments tracing the connector's path.
// Used for both rendering and line-jump intersection tests.
function getPathSegments(s, t, shape) {
  if (shape === 'straight') return [[s, t]]
  if (shape === 'rounded') return getPathSegments(s, t, 'orthogonal')
  if (shape === 'orthogonal') {
    const sH = isHorizontal(s.side)
    const tH = isHorizontal(t.side)
    if (sH && tH) {
      const midX = (s.x + t.x) / 2
      return [
        [s, { x: midX, y: s.y }],
        [{ x: midX, y: s.y }, { x: midX, y: t.y }],
        [{ x: midX, y: t.y }, t],
      ]
    }
    if (!sH && !tH) {
      const midY = (s.y + t.y) / 2
      return [
        [s, { x: s.x, y: midY }],
        [{ x: s.x, y: midY }, { x: t.x, y: midY }],
        [{ x: t.x, y: midY }, t],
      ]
    }
    if (sH && !tH) {
      return [
        [s, { x: t.x, y: s.y }],
        [{ x: t.x, y: s.y }, t],
      ]
    }
    return [
      [s, { x: s.x, y: t.y }],
      [{ x: s.x, y: t.y }, t],
    ]
  }
  return []
}

function roundedPath(s, t) {
  const segs = getPathSegments(s, t, 'orthogonal')
  if (!segs.length) return `M ${s.x} ${s.y} L ${t.x} ${t.y}`
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

function curvedPath(s, t) {
  const sH = isHorizontal(s.side)
  const tH = isHorizontal(t.side)
  const dist = Math.max(40, Math.hypot(t.x - s.x, t.y - s.y) * 0.4)
  const c1 = sH
    ? { x: s.x + (s.side === 'right' ? dist : -dist), y: s.y }
    : { x: s.x, y: s.y + (s.side === 'bottom' ? dist : -dist) }
  const c2 = tH
    ? { x: t.x + (t.side === 'right' ? dist : -dist), y: t.y }
    : { x: t.x, y: t.y + (t.side === 'bottom' ? dist : -dist) }
  return `M ${s.x} ${s.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${t.x} ${t.y}`
}

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
    if (!otherSegments?.length) {
      d += ` L ${b.x} ${b.y}`
      continue
    }
    const intersections = []
    for (const seg of otherSegments) {
      const p = segmentIntersect(a, b, seg.a, seg.b)
      if (p) intersections.push(p)
    }
    if (!intersections.length) {
      d += ` L ${b.x} ${b.y}`
      continue
    }
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    if (len < radius * 2.5) {
      d += ` L ${b.x} ${b.y}`
      continue
    }
    const ux = dx / len
    const uy = dy / len
    // Filter out crossings too close to segment endpoints
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
      const after = { x: p.x + ux * radius, y: p.y + uy * radius }
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

export default function Connector({
  conn,
  source,
  target,
  targetPoint,
  offset = { x: 0, y: 0 },
  ghost = false,
  selected = false,
  onSelect,
  crossingSegments = [],
}) {
  const uid = useId()
  const arrowId = `arrow-${uid}`
  const sourceCenter = rectCenter(source)
  const targetCenter = target ? rectCenter(target) : targetPoint
  const s = pickAnchor(source, targetCenter, conn?.source_side)
  const t = target
    ? pickAnchor(target, sourceCenter, conn?.target_side)
    : { ...targetPoint, side: 'left' }

  const S = { ...s, x: s.x + offset.x, y: s.y + offset.y }
  const T = { ...t, x: t.x + offset.x, y: t.y + offset.y }

  const shape = conn?.shape || 'orthogonal'
  const style = conn?.style || 'solid'
  const thickness = conn?.thickness ?? 2
  const arrowStart = conn?.arrow_start ?? false
  const arrowEnd = conn?.arrow_end ?? true
  const lineJumps = conn?.line_jumps ?? true

  let d
  if (shape === 'curved') {
    d = curvedPath(S, T)
  } else if (shape === 'rounded' && !ghost) {
    d = roundedPath(S, T)
  } else {
    const segments = getPathSegments(S, T, ghost ? 'straight' : shape)
    d = !ghost && lineJumps
      ? buildPathWithJumps(segments, crossingSegments)
      : buildPlainPath(segments)
  }

  const stroke = ghost ? '#9ca3af' : selected ? '#3b82f6' : '#1f2330'
  const strokeWidth = ghost ? 1.6 : thickness
  const dash = dashArray(style, thickness)

  return (
    <g
      onMouseDown={(e) => {
        if (ghost) return
        e.stopPropagation()
        onSelect && onSelect()
      }}
      style={{ cursor: ghost ? 'default' : 'pointer' }}
    >
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth={Math.max(4, 7 - thickness * 0.4)}
          markerHeight={Math.max(4, 7 - thickness * 0.4)}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
        </marker>
      </defs>

      {!ghost && (
        <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(14, thickness + 12)} className="connector-hit" />
      )}
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
        className="connector-line"
      />
    </g>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export { pickAnchor, rectCenter, getPathSegments }
