import { useEffect, useRef, useState } from 'react'
import { IconCheck, IconGridDots, IconLock, IconSettings } from './Icons'
import '../styles/BoardSettings.css'

const APPEARANCE_OPTIONS = [
  { value: 'dotted', label: 'Dotted', Icon: IconGridDots },
  { value: 'clear', label: 'Clear', Icon: IconCheck },
]

export default function BoardSettings({ boardAppearance, onBoardAppearanceChange, onLock }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    const onPointerDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  return (
    <div className="board-settings" ref={wrapRef}>
      <button
        type="button"
        className={`bs-trigger${open ? ' active' : ''}`}
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <IconSettings />
      </button>

      {open && (
        <div className="bs-panel" role="menu">
          <div className="bs-section">
            <div className="bs-label">Board appearance</div>
            <div className="bs-segmented">
              {APPEARANCE_OPTIONS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={`bs-segment${boardAppearance === value ? ' active' : ''}`}
                  onClick={() => onBoardAppearanceChange(value)}
                >
                  <Icon />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="bs-action danger"
            onClick={() => {
              setOpen(false)
              onLock?.()
            }}
          >
            <IconLock />
            <span>Lock board</span>
          </button>
        </div>
      )}
    </div>
  )
}
