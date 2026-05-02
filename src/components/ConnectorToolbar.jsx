import '../styles/ConnectorToolbar.css'

const SHAPES = [
  { id: 'straight', label: 'Straight', icon: '╱' },
  { id: 'orthogonal', label: 'Orthogonal', icon: '⌐' },
  { id: 'curved', label: 'Curved', icon: '∼' },
]

const STYLES = [
  { id: 'solid', label: 'Solid' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dotted', label: 'Dotted' },
]

const ARROWS = [
  { id: 'none', start: false, end: false, label: 'None' },
  { id: 'end', start: false, end: true, label: '→' },
  { id: 'both', start: true, end: true, label: '↔' },
  { id: 'start', start: true, end: false, label: '←' },
]

function arrowKey(c) {
  const s = !!c.arrow_start
  const e = !!c.arrow_end
  if (s && e) return 'both'
  if (s) return 'start'
  if (e) return 'end'
  return 'none'
}

export default function ConnectorToolbar({ connector, onUpdate, onDelete, screenX, screenY }) {
  if (!connector) return null
  const ak = arrowKey(connector)

  return (
    <div className="conn-toolbar" style={{ left: screenX, top: screenY }}>
      <div className="conn-group">
        {ARROWS.map((a) => (
          <button
            key={a.id}
            className={`ct-btn ${ak === a.id ? 'active' : ''}`}
            title={`Arrow: ${a.label}`}
            onClick={() => onUpdate({ arrow_start: a.start, arrow_end: a.end })}
          >
            <span className="ct-icon">{a.label}</span>
          </button>
        ))}
      </div>

      <div className="conn-divider" />

      <div className="conn-group">
        {SHAPES.map((s) => (
          <button
            key={s.id}
            className={`ct-btn ${(connector.shape || 'orthogonal') === s.id ? 'active' : ''}`}
            title={`Type: ${s.label}`}
            onClick={() => onUpdate({ shape: s.id })}
          >
            <span className="ct-icon">{s.icon}</span>
          </button>
        ))}
      </div>

      <div className="conn-divider" />

      <div className="conn-group">
        {STYLES.map((s) => (
          <button
            key={s.id}
            className={`ct-btn ${(connector.style || 'solid') === s.id ? 'active' : ''}`}
            title={`Style: ${s.label}`}
            onClick={() => onUpdate({ style: s.id })}
          >
            <DashPreview style={s.id} />
          </button>
        ))}
      </div>

      <div className="conn-divider" />

      <div className="conn-group">
        <input
          type="range"
          min="1"
          max="6"
          step="1"
          value={connector.thickness ?? 2}
          onChange={(e) => onUpdate({ thickness: Number(e.target.value) })}
          title="Thickness"
        />
      </div>

      {connector.shape === 'straight' && (
        <>
          <div className="conn-divider" />
          <div className="conn-group">
            <button
              className={`ct-btn ${connector.line_jumps ? 'active' : ''}`}
              title="Line jumps"
              onClick={() => onUpdate({ line_jumps: !connector.line_jumps })}
            >
              <span className="ct-icon">∿</span>
            </button>
          </div>
        </>
      )}

      <div className="conn-divider" />

      <div className="conn-group">
        <button className="ct-btn danger" title="Delete" onClick={onDelete}>🗑</button>
      </div>
    </div>
  )
}

function DashPreview({ style }) {
  const dash =
    style === 'dashed' ? '6 4' : style === 'dotted' ? '1 3' : undefined
  return (
    <svg width="22" height="10" viewBox="0 0 22 10">
      <line
        x1="2"
        y1="5"
        x2="20"
        y2="5"
        stroke="#1f2330"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={dash}
      />
    </svg>
  )
}
