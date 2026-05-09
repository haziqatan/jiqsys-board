import {
  IconArrow,
  IconArrowBoth,
  IconArrowLeft,
  IconArrowNone,
  IconStraight,
  IconOrthogonal,
  IconRounded,
  IconCurved,
  IconJump,
  IconText,
  IconTrash,
} from './Icons'
import '../styles/ConnectorToolbar.css'

const SHAPES = [
  { id: 'straight',    label: 'Straight',    Icon: IconStraight },
  { id: 'orthogonal',  label: 'Orthogonal',  Icon: IconOrthogonal },
  { id: 'rounded',     label: 'Rounded',     Icon: IconRounded },
  { id: 'curved',      label: 'Curved',      Icon: IconCurved },
]

const STYLES = [
  { id: 'solid', label: 'Solid' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dotted', label: 'Dotted' },
]

const ARROWS = [
  { id: 'none', start: false, end: false, label: 'No arrows', Icon: IconArrowNone },
  { id: 'end', start: false, end: true, label: 'Forward', Icon: IconArrow },
  { id: 'both', start: true, end: true, label: 'Both', Icon: IconArrowBoth },
  { id: 'start', start: true, end: false, label: 'Backward', Icon: IconArrowLeft },
]

function arrowKey(c) {
  const s = !!c.arrow_start
  const e = !!c.arrow_end
  if (s && e) return 'both'
  if (s) return 'start'
  if (e) return 'end'
  return 'none'
}

export default function ConnectorToolbar({ connector, onUpdate, onDelete, onAddLabel, screenX, screenY }) {
  if (!connector) return null
  const ak = arrowKey(connector)
  const shape = connector.shape || 'orthogonal'
  const style = connector.style || 'solid'
  const thickness = connector.thickness ?? 2
  const lineJumps = connector.line_jumps ?? true
  const hasLabel = connector.label_text != null

  return (
    <div className="conn-toolbar" style={{ left: screenX, top: screenY }}>
      <div className="conn-group">
        {ARROWS.map(({ id, start, end, label, Icon }) => (
          <button
            key={id}
            className={`ct-btn ${ak === id ? 'active' : ''}`}
            title={label}
            onClick={() => onUpdate({ arrow_start: start, arrow_end: end })}
          >
            <Icon />
          </button>
        ))}
      </div>

      <div className="conn-divider" />

      <div className="conn-group">
        {SHAPES.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`ct-btn ${shape === id ? 'active' : ''}`}
            title={label}
            onClick={() => onUpdate({ shape: id, waypoints: [] })}
          >
            <Icon />
          </button>
        ))}
      </div>

      <div className="conn-divider" />

      <div className="conn-group">
        {STYLES.map((s) => (
          <button
            key={s.id}
            className={`ct-btn ${style === s.id ? 'active' : ''}`}
            title={s.label}
            onClick={() => onUpdate({ style: s.id })}
          >
            <DashPreview style={s.id} />
          </button>
        ))}
      </div>

      <div className="conn-divider" />

      <div className="conn-group thickness">
        <input
          type="range"
          min="1"
          max="6"
          step="1"
          value={thickness}
          onChange={(e) => onUpdate({ thickness: Number(e.target.value) })}
          aria-label="Thickness"
        />
        <span className="thickness-num">{thickness}</span>
      </div>

      {shape !== 'curved' && (
        <>
          <div className="conn-divider" />
          <div className="conn-group">
            <button
              className={`ct-btn ${lineJumps ? 'active' : ''}`}
              title="Line jumps"
              onClick={() => onUpdate({ line_jumps: !lineJumps })}
            >
              <IconJump />
            </button>
          </div>
        </>
      )}

      <div className="conn-divider" />

      <div className="conn-group">
        <button
          className={`ct-btn ${hasLabel ? 'active' : ''}`}
          title="Connector text"
          onClick={() => {
            if (hasLabel) {
              onUpdate({ label_text: null, label_x: null, label_y: null })
            } else {
              onAddLabel?.()
            }
          }}
        >
          <IconText />
        </button>
      </div>

      <div className="conn-divider" />

      <div className="conn-group">
        <button className="ct-btn danger" title="Delete" onClick={onDelete}>
          <IconTrash />
        </button>
      </div>
    </div>
  )
}

function DashPreview({ style }) {
  const dash =
    style === 'dashed' ? '6 4' : style === 'dotted' ? '1.5 3' : undefined
  return (
    <svg width="22" height="14" viewBox="0 0 22 14">
      <line
        x1="2"
        y1="7"
        x2="20"
        y2="7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={dash}
      />
    </svg>
  )
}
