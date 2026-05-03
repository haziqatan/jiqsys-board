import { useEffect, useRef, useState } from 'react'
import { IconMenu, IconPlus, IconEdit, IconTrash, IconCheck, IconClose } from './Icons'
import '../styles/BoardMenu.css'

export default function BoardMenu({
  boards,
  currentId,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
}) {
  const [open, setOpen] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setRenamingId(null)
        setConfirmDeleteId(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const startRename = (board) => {
    setConfirmDeleteId(null)
    setRenamingId(board.id)
    setRenameValue(board.name)
  }

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim())
    }
    setRenamingId(null)
  }

  const current = boards.find((b) => b.id === currentId)

  return (
    <div className="board-menu" ref={ref}>
      <button
        className="burger-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Boards"
        aria-expanded={open}
      >
        <IconMenu />
      </button>
      <div className="current-board-name">{current?.name || 'Loading…'}</div>

      {open && (
        <div className="board-menu-panel">
          <div className="board-menu-header">Boards</div>

          <div className="board-list">
            {boards.map((b) => {
              const isCurrent = b.id === currentId
              if (renamingId === b.id) {
                return (
                  <div key={b.id} className="board-row editing">
                    <input
                      autoFocus
                      className="board-rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename()
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                    <button
                      className="board-icon-btn confirm"
                      title="Save"
                      onClick={commitRename}
                    >
                      <IconCheck />
                    </button>
                    <button
                      className="board-icon-btn"
                      title="Cancel"
                      onClick={() => setRenamingId(null)}
                    >
                      <IconClose />
                    </button>
                  </div>
                )
              }
              if (confirmDeleteId === b.id) {
                return (
                  <div key={b.id} className="board-row confirming">
                    <span className="confirm-msg">
                      Delete <b>“{b.name}”</b>?
                    </span>
                    <button
                      className="board-icon-btn danger"
                      title="Confirm delete"
                      onClick={() => {
                        onDelete(b.id)
                        setConfirmDeleteId(null)
                      }}
                    >
                      <IconCheck />
                    </button>
                    <button
                      className="board-icon-btn"
                      title="Cancel"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      <IconClose />
                    </button>
                  </div>
                )
              }
              return (
                <div key={b.id} className={`board-row${isCurrent ? ' active' : ''}`}>
                  <button
                    className="board-name-btn"
                    onClick={() => {
                      onSwitch(b.id)
                      setOpen(false)
                    }}
                  >
                    <span className="board-active-dot" />
                    <span className="board-name-text">{b.name}</span>
                  </button>
                  <button
                    className="board-icon-btn"
                    title="Rename"
                    onClick={() => startRename(b)}
                  >
                    <IconEdit />
                  </button>
                  {boards.length > 1 && (
                    <button
                      className="board-icon-btn danger-hover"
                      title="Delete board"
                      onClick={() => {
                        setRenamingId(null)
                        setConfirmDeleteId(b.id)
                      }}
                    >
                      <IconTrash />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <div className="board-menu-divider" />
          <button
            className="board-new-btn"
            onClick={() => {
              onCreate()
              setOpen(false)
            }}
          >
            <IconPlus />
            <span>New board</span>
          </button>
        </div>
      )}
    </div>
  )
}
