import { IconCursor, IconCard, IconCircle, IconDiamond, IconHexagon, IconParallelogram } from './Icons'
import '../styles/Toolbar.css'

const SELECT_TOOLS = [
  { id: 'select', label: 'Select', shortcut: 'V', Icon: IconCursor },
]

const CARD_TOOLS = [
  { id: 'card',        label: 'Card', shortcut: 'C', Icon: IconCard },
  { id: 'card-circle', label: 'Circle',    shortcut: null, Icon: IconCircle },
  { id: 'card-diamond',label: 'Diamond',   shortcut: null, Icon: IconDiamond },
  { id: 'card-hex',    label: 'Hexagon',   shortcut: null, Icon: IconHexagon },
  { id: 'card-para',   label: 'Parallelogram', shortcut: null, Icon: IconParallelogram },
]

export default function Toolbar({ tool, setTool }) {
  return (
    <div className="toolbar">
      {SELECT_TOOLS.map(({ id, label, shortcut, Icon }) => (
        <button
          key={id}
          className={`tool-btn ${tool === id ? 'active' : ''}`}
          onClick={() => setTool(id)}
          aria-label={label}
        >
          <Icon />
          <span className="tool-tooltip">
            {label}
            {shortcut && <kbd>{shortcut}</kbd>}
          </span>
        </button>
      ))}

      <div className="toolbar-divider" />

      {CARD_TOOLS.map(({ id, label, shortcut, Icon }) => (
        <button
          key={id}
          className={`tool-btn ${tool === id ? 'active' : ''}`}
          onClick={() => setTool(id)}
          aria-label={label}
        >
          <Icon />
          <span className="tool-tooltip">
            {label}
            {shortcut && <kbd>{shortcut}</kbd>}
          </span>
        </button>
      ))}
    </div>
  )
}
