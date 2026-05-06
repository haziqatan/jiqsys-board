import { useEffect, useRef, useState } from 'react'
import {
  IconCursor, IconCard, IconText, IconTable,
  IconShapes, IconRectangle, IconSquare,
  IconCircle, IconDiamond, IconHexagon, IconParallelogram,
  IconTriangle, IconStar, IconArrowShape,
} from './Icons'
import '../styles/Toolbar.css'

const SHAPE_TOOLS = [
  { id: 'card-rect-shape', label: 'Rectangle',     Icon: IconRectangle },
  { id: 'card-square',     label: 'Square',        Icon: IconSquare },
  { id: 'card-circle',     label: 'Circle',        Icon: IconCircle },
  { id: 'card-diamond',    label: 'Diamond',       Icon: IconDiamond },
  { id: 'card-hex',        label: 'Hexagon',       Icon: IconHexagon },
  { id: 'card-para',       label: 'Parallelogram', Icon: IconParallelogram },
  { id: 'card-triangle',   label: 'Triangle',      Icon: IconTriangle },
  { id: 'card-star',       label: 'Star',          Icon: IconStar },
  { id: 'card-arrow',      label: 'Arrow',         Icon: IconArrowShape },
]

export default function Toolbar({ tool, setTool }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef(null)

  const activeShape = SHAPE_TOOLS.find((s) => s.id === tool)
  const ShapeIcon = activeShape ? activeShape.Icon : IconShapes
  const isShapeActive = !!activeShape

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
        aria-label="Card"
      >
        <IconCard />
        <span className="tool-tooltip">Card <kbd>C</kbd></span>
      </button>

      <button
        className={`tool-btn ${tool === 'text' ? 'active' : ''}`}
        onClick={() => { setTool('text'); setPickerOpen(false) }}
        aria-label="Text"
      >
        <IconText />
        <span className="tool-tooltip">Text <kbd>T</kbd></span>
      </button>

      <button
        className={`tool-btn ${tool === 'card-table' ? 'active' : ''}`}
        onClick={() => { setTool('card-table'); setPickerOpen(false) }}
        aria-label="Table"
      >
        <IconTable />
        <span className="tool-tooltip">Table</span>
      </button>

      <div className="shapes-wrap" ref={pickerRef}>
        <button
          className={`tool-btn ${isShapeActive ? 'active' : ''}`}
          onClick={() => setPickerOpen((v) => !v)}
          aria-label="Shapes"
          aria-expanded={pickerOpen}
        >
          <ShapeIcon />
          <span className="tool-tooltip">Shapes <kbd>S</kbd></span>
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
