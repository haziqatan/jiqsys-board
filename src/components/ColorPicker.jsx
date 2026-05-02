import '../styles/ColorPicker.css'

const PALETTE = [
  '#3b82f6', '#06b6d4', '#22c55e', '#eab308',
  '#f97316', '#ef4444', '#ec4899', '#a855f7',
  '#64748b', '#1f2330', '#ffffff', '#f1f5f9',
]

export default function ColorPicker({ value, onChange }) {
  return (
    <div className="color-picker">
      <div className="color-grid">
        {PALETTE.map((c) => (
          <button
            key={c}
            className={`color-option ${value === c ? 'active' : ''}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
            title={c}
          />
        ))}
      </div>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="color-input"
      />
    </div>
  )
}
