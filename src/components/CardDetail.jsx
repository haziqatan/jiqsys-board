import { useState } from 'react'
import RichTextEditor from './RichTextEditor'
import ColorPicker from './ColorPicker'
import TagManager from './TagManager'
import { IconClose, IconTrash, IconPanelLeft, IconModal, IconExpandFull } from './Icons'
import '../styles/CardDetail.css'

const STATUS_OPTIONS = ['Not set', 'To Do', 'In Progress', 'Blocked', 'Done']
const MODES = ['side', 'modal', 'fullscreen']
const MODE_ICONS = { side: IconPanelLeft, modal: IconModal, fullscreen: IconExpandFull }
const MODE_TITLES = { side: 'Side panel', modal: 'Centered modal', fullscreen: 'Full screen' }

export default function CardDetail({ card, onUpdate, onDelete, onClose }) {
  const [mode, setMode] = useState('side')
  const [title, setTitle] = useState(card.title)
  const [color, setColor] = useState(card.color)
  const [status, setStatus] = useState(card.status || 'Not set')
  const [assignee, setAssignee] = useState(card.assignee || '')
  const [estimate, setEstimate] = useState(card.estimate ?? '')
  const [startDate, setStartDate] = useState(card.start_date || '')
  const [endDate, setEndDate] = useState(card.end_date || '')
  const [tags, setTags] = useState(card.tags || [])
  const [showColor, setShowColor] = useState(false)

  const nextMode = () => setMode((m) => MODES[(MODES.indexOf(m) + 1) % MODES.length])
  const NextIcon = MODE_ICONS[MODES[(MODES.indexOf(mode) + 1) % MODES.length]]

  const commit = (patch) => onUpdate(patch)

  return (
    <>
      {mode !== 'side' && <div className="cd-backdrop" onClick={onClose} />}
      <aside className={`card-detail mode-${mode}`}>
      <div className="cd-header">
        <h2>Card details</h2>
        <div className="cd-header-actions">
          <button
            className="cd-icon-btn"
            title={`Switch to ${MODE_TITLES[MODES[(MODES.indexOf(mode) + 1) % MODES.length]]}`}
            onClick={nextMode}
          >
            <NextIcon />
          </button>
          <button className="cd-icon-btn" title="Delete card" onClick={onDelete}>
            <IconTrash />
          </button>
          <button className="cd-icon-btn" title="Close" onClick={onClose}>
            <IconClose />
          </button>
        </div>
      </div>

      <div className="cd-row">
        <label>Title</label>
        <input
          className="cd-input cd-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => commit({ title })}
          onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
        />
      </div>

      <div className="cd-row">
        <label>Color</label>
        <div className="cd-value">
          <button
            className="cd-color-swatch"
            style={{ background: color }}
            onClick={() => setShowColor((v) => !v)}
          />
          {showColor && (
            <ColorPicker
              value={color}
              onChange={(c) => {
                setColor(c)
                commit({ color: c })
                setShowColor(false)
              }}
            />
          )}
        </div>
      </div>

      <div className="cd-row">
        <label>Status</label>
        <select
          className="cd-input"
          value={status}
          onChange={(e) => {
            const v = e.target.value
            setStatus(v)
            commit({ status: v === 'Not set' ? null : v })
          }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="cd-row">
        <label>Assignee</label>
        <input
          className="cd-input"
          placeholder="Not set"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          onBlur={() => commit({ assignee: assignee || null })}
        />
      </div>

      <div className="cd-row">
        <label>Estimate</label>
        <input
          className="cd-input"
          type="number"
          placeholder="—"
          value={estimate}
          onChange={(e) => setEstimate(e.target.value)}
          onBlur={() => commit({ estimate: estimate === '' ? null : Number(estimate) })}
        />
      </div>

      <div className="cd-row">
        <label>Start Date</label>
        <input
          className="cd-input"
          type="date"
          value={startDate || ''}
          onChange={(e) => {
            setStartDate(e.target.value)
            commit({ start_date: e.target.value || null })
          }}
        />
      </div>

      <div className="cd-row">
        <label>End Date</label>
        <input
          className="cd-input"
          type="date"
          value={endDate || ''}
          onChange={(e) => {
            setEndDate(e.target.value)
            commit({ end_date: e.target.value || null })
          }}
        />
      </div>

      <div className="cd-row">
        <label>Tags</label>
        <TagManager
          tags={tags}
          onChange={(next) => {
            setTags(next)
            commit({ tags: next })
          }}
        />
      </div>

      <div className="cd-divider" />

      <div className="cd-description">
        <RichTextEditor
          value={card.description?.html || ''}
          onChange={(html) => commit({ description: { html } })}
        />
      </div>
    </aside>
    </>
  )
}
