import { useEffect, useRef, useState } from 'react'
import {
  IconCursor, IconCard,
  IconShapes, IconCircle, IconDiamond, IconHexagon, IconParallelogram,
} from './Icons'
import '../styles/Toolbar.css'

const SHAPE_TOOLS = [
  { id: 'card-circle',  label: 'Circle',        Icon: IconCircle },
  { id: 'card-diamond', label: 'Diamond',       Icon: IconDiamond },
  { id: 'card-hex',     label: 'Hexagon',       Icon: IconHexagon },
  { id: 'card-para',    label: 'Parallelogram', Icon: IconParallelogram },
]

export default function Toolbar({ tool, setTool }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef(null)

  const activeShape = SHAPE_TOOLS.find((s) => s.id === tool)
  const ShapeIcon = activeShape ? activeShape.Icon : IconShapes
  const isShapeActive = !!activeShape

  // Close picker on outside click
  useEffect(() => {
    const onDown = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const selectShape = (id) => {
    setTool(id)
    setPickerOpen(false)
  }

  return (
    <div className="toolbar">
      <button
        className={`tool-btn ${tool === 'select' ? 'active' : ''}`}
        onClick={() => { setTool('select'); setPickerOpen(false) }}
        aria-label="Select"
      >
        <IconCursor />
        <span className="tool-tooltip">Select <kbd>V</kbd></span>
      </button>

      <div className="toolbar-divider" />

      <button
        className={`tool-btn ${tool === 'card' ? 'active' : ''}`}
        onClick={() => { setTool('card'); setPickerOpen(false) }}
        aria-label="Add card"
      >
        <IconCard />
        <span className="tool-tooltip">Card <kbd>C</kbd></span>
      </button>

      {/* Shapes button — toggles picker */}
      <div className="shapes-wrap" ref={pickerRef}>
        <button
          className={`tool-btn ${isShapeActive ? 'active' : ''}`}
          onClick={() => setPickerOpen((v) => !v)}
          aria-label="Shapes"
          aria-expanded={pickerOpen}
        >
          <ShapeIcon />
          <span className="tool-tooltip">Shapes</span>
        </button>

        {pickerOpen && (
          <div className="shape-picker" role="menu">
            {SHAPE_TOOLS.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={`shape-picker-btn ${tool === id ? 'active' : ''}`}
                onClick={() => selectShape(id)}
                role="menuitem"
              >
                <Icon width={20} height={20} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
