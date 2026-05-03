import { useState } from 'react'
import RichTextEditor from './RichTextEditor'
import ColorPicker from './ColorPicker'
import TagManager from './TagManager'
import { IconClose, IconTrash, IconPanelLeft, IconModal, IconExpandFull } from './Icons'
import { getStatusOptions, normalizeStatus } from '../lib/status'
import '../styles/CardDetail.css'

const COLOR_BAR_STYLES = [
  { id: 'solid',    label: 'Solid' },
  { id: 'striped',  label: 'Striped' },
  { id: 'animated', label: 'Animated' },
]
const MODES = ['side', 'modal', 'fullscreen']
const MODE_ICONS = { side: IconPanelLeft, modal: IconModal, fullscreen: IconExpandFull }
const MODE_TITLES = { side: 'Side panel', modal: 'Centered modal', fullscreen: 'Full screen' }

export default function CardDetail({ card, onUpdate, onDelete, onClose }) {
  const [mode, setMode] = useState('side')
  const [title, setTitle] = useState(card.title)
  const [color, setColor] = useState(card.color)
  const [barStyle, setBarStyle] = useState(card.color_bar_style || 'solid')
  const [status, setStatus] = useState(card.status || null)
  const [assignee, setAssignee] = useState(card.assignee || '')
  const [estimate, setEstimate] = useState(card.estimate ?? '')
  const [startDate, setStartDate] = useState(card.start_date || '')
  const [endDate, setEndDate] = useState(card.end_date || '')
  const [tags, setTags] = useState(card.tags || [])
  const [showColor, setShowColor] = useState(false)

  const nextMode = () => setMode((m) => MODES[(MODES.indexOf(m) + 1) % MODES.length])
  const NextIcon = MODE_ICONS[MODES[(MODES.indexOf(mode) + 1) % MODES.length]]
  const normalizedStatus = normalizeStatus(status)
  const statusOptions = getStatusOptions(normalizedStatus)

  const commit = (patch) => onUpdate(patch)
  const commitStatus = () => {
    const nextStatus = normalizeStatus(status)
    setStatus(nextStatus)
    commit({ status: nextStatus })
  }

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
        <label>Color bar</label>
        <div className="cd-bar-picker">
          {COLOR_BAR_STYLES.map((s) => (
            <button
              key={s.id}
              className={`cd-bar-btn${barStyle === s.id ? ' active' : ''}`}
              onClick={() => { setBarStyle(s.id); commit({ color_bar_style: s.id }) }}
              title={s.label}
              type="button"
            >
              <span
                className={`bar-preview style-${s.id}`}
                style={{ backgroundColor: color }}
              />
              <span className="bar-label">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="cd-row">
        <label>Status</label>
        <div className="cd-status-control">
          <div className="cd-status-picker">
            {statusOptions.map((s) => (
              <button
                key={s.label}
                type="button"
                className={`cd-status-pill${normalizedStatus === s.value ? ' active' : ''}`}
                onClick={() => { setStatus(s.value); commit({ status: s.value }) }}
                style={normalizedStatus === s.value ? { '--pill-c': s.color } : undefined}
              >
                <span className="cd-status-dot" style={{ background: s.color }} />
                {s.label}
              </button>
            ))}
          </div>
          <input
            className="cd-input cd-status-input"
            placeholder="Custom status"
            value={status || ''}
            onChange={(e) => setStatus(e.target.value)}
            onBlur={commitStatus}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.target.blur()
              if (e.key === 'Escape') setStatus(card.status || null)
            }}
          />
        </div>
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
