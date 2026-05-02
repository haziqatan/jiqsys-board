function centerOf(card) {
  return { x: card.x + card.width / 2, y: card.y + card.height / 2 }
}

function edgePoint(card, target) {
  const c = centerOf(card)
  const dx = target.x - c.x
  const dy = target.y - c.y
  const halfW = card.width / 2
  const halfH = card.height / 2
  if (dx === 0 && dy === 0) return c
  const sx = dx === 0 ? Infinity : Math.abs(halfW / dx)
  const sy = dy === 0 ? Infinity : Math.abs(halfH / dy)
  const s = Math.min(sx, sy)
  return { x: c.x + dx * s, y: c.y + dy * s }
}

function orthogonalPath(a, b) {
  const midX = (a.x + b.x) / 2
  return `M ${a.x} ${a.y} L ${midX} ${a.y} L ${midX} ${b.y} L ${b.x} ${b.y}`
}

export default function Connector({
  source,
  target,
  targetPoint,
  offset = { x: 0, y: 0 },
  ghost = false,
  selected = false,
  onSelect,
}) {
  const targetCenter = target ? centerOf(target) : targetPoint
  const sourceCenter = centerOf(source)
  const a = edgePoint(source, targetCenter)
  const b = target ? edgePoint(target, sourceCenter) : targetPoint

  const A = { x: a.x + offset.x, y: a.y + offset.y }
  const B = { x: b.x + offset.x, y: b.y + offset.y }

  const d = orthogonalPath(A, B)

  const stroke = ghost ? '#9ca3af' : selected ? '#3b82f6' : '#1f2330'
  const dash = ghost ? '6 4' : undefined

  return (
    <g
      onMouseDown={(e) => {
        if (ghost) return
        e.stopPropagation()
        onSelect && onSelect()
      }}
      style={{ cursor: ghost ? 'default' : 'pointer' }}
    >
      {!ghost && (
        <path d={d} fill="none" stroke="transparent" strokeWidth="14" className="connector-hit" />
      )}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={selected ? 2.5 : 1.8}
        strokeDasharray={dash}
        markerEnd={ghost ? undefined : 'url(#arrowhead)'}
        className="connector-line"
      />
      <defs>
        <marker
          id="arrowhead"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
        </marker>
      </defs>
    </g>
  )
}
