import '../styles/Toolbar.css'

const TOOLS = [
  { id: 'select', label: 'Select', icon: '↖' },
  { id: 'card', label: 'Add card', icon: '▢' },
]

export default function Toolbar({ tool, setTool }) {
  return (
    <div className="toolbar">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={`tool-btn ${tool === t.id ? 'active' : ''}`}
          onClick={() => setTool(t.id)}
          title={t.label}
        >
          <span className="tool-icon">{t.icon}</span>
        </button>
      ))}
      <div className="toolbar-divider" />
      <div className="toolbar-hint">
        Drag canvas to pan · Scroll to scroll · ⌘/Ctrl+Scroll to zoom
      </div>
    </div>
  )
}
