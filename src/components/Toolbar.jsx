import { IconCursor, IconCard } from './Icons'
import '../styles/Toolbar.css'

const TOOLS = [
  { id: 'select', label: 'Select', shortcut: 'V', Icon: IconCursor },
  { id: 'card', label: 'Add card', shortcut: 'C', Icon: IconCard },
]

export default function Toolbar({ tool, setTool }) {
  return (
    <div className="toolbar">
      {TOOLS.map(({ id, label, shortcut, Icon }) => (
        <button
          key={id}
          className={`tool-btn ${tool === id ? 'active' : ''}`}
          onClick={() => setTool(id)}
          aria-label={label}
        >
          <Icon />
          <span className="tool-tooltip">
            {label}
            <kbd>{shortcut}</kbd>
          </span>
        </button>
      ))}
    </div>
  )
}
