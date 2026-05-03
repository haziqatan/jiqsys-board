import { useEffect, useState } from 'react'
import RichTextEditor from './RichTextEditor'
import ColorPicker from './ColorPicker'
import TagManager from './TagManager'
import { IconClose, IconTrash, IconPanelLeft, IconModal, IconExpandFull, IconPlus } from './Icons'
import { getStatusOptions, normalizeStatus, getStatusColor } from '../lib/status'
import '../styles/CardDetail.css'

const COLOR_BAR_STYLES = [
  { id: 'solid',    label: 'Solid' },
  { id: 'striped',  label: 'Striped' },
  { id: 'animated', label: 'Animated' },
]
const MODES = ['side', 'modal', 'fullscreen']
const MODE_ICONS = { side: IconPanelLeft, modal: IconModal, fullscreen: IconExpandFull }
const MODE_TITLES = { side: 'Side panel', modal: 'Centered modal', fullscreen: 'Full screen' }

export default function CardDetail({
  card,
  statusOptions,
  onUpdate,
  onCreateStatus,
  onUpdateStatus,
  onDeleteStatus,
  onDelete,
  onClose,
}) {
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
  const [newStatus, setNewStatus] = useState('')
  const [newStatusColor, setNewStatusColor] = useState('#0ea5e9')

  const nextMode = () => setMode((m) => MODES[(MODES.indexOf(m) + 1) % MODES.length])
  const NextIcon = MODE_ICONS[MODES[(MODES.indexOf(mode) + 1) % MODES.length]]
  const normalizedStatus = normalizeStatus(status)
  const availableStatusOptions = getStatusOptions(normalizedStatus, statusOptions)
  const editableStatusOptions = statusOptions.filter((option) => option.value)

  const commit = (patch) => onUpdate(patch)
  const createAndSelectStatus = () => {
    const option = onCreateStatus(newStatus, newStatusColor)
    if (!option) return
    setNewStatus('')
    setStatus(option.value)
    commit({ status: option.value })
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
            {availableStatusOptions.map((s) => (
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
          <div className="cd-status-library">
            {editableStatusOptions.map((option) => (
              <StatusOptionEditor
                key={option.id}
                option={option}
                selected={normalizedStatus === option.value}
                onSelect={() => { setStatus(option.value); commit({ status: option.value }) }}
                onUpdate={(patch) => {
                  const nextStatus = onUpdateStatus(option.id, patch)
                  if (normalizedStatus === option.value && nextStatus) {
                    setStatus(nextStatus)
                    commit({ status: nextStatus })
                  }
                }}
                onDelete={() => {
                  if (normalizedStatus === option.value) {
                    setStatus(null)
                    commit({ status: null })
                  }
                  onDeleteStatus(option.id)
                }}
              />
            ))}
          </div>
          <div className="cd-status-add">
            <input
              className="cd-input"
              placeholder="New status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createAndSelectStatus()
              }}
            />
            <input
              className="cd-status-color"
              type="color"
              value={newStatusColor}
              onChange={(e) => setNewStatusColor(e.target.value)}
              title="Status color"
            />
            <button
              className="cd-icon-btn"
              type="button"
              title="Add status"
              onClick={createAndSelectStatus}
            >
              <IconPlus />
            </button>
          </div>
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

function StatusOptionEditor({ option, selected, onSelect, onUpdate, onDelete }) {
  const [label, setLabel] = useState(option.label)

  useEffect(() => {
    setLabel(option.label)
  }, [option.label])

  const commitLabel = () => {
    const nextLabel = normalizeStatus(label)
    if (!nextLabel) {
      setLabel(option.label)
      return
    }
    if (nextLabel !== option.label) {
      const nextStatus = onUpdate({ label: nextLabel })
      if (!nextStatus) setLabel(option.label)
    }
  }

  return (
    <div className={`cd-status-editor${selected ? ' active' : ''}`}>
      <button
        type="button"
        className="cd-status-select"
        title="Apply status"
        onClick={onSelect}
      >
        <span style={{ background: getStatusColor(option.value, [option]) }} />
      </button>
      <input
        className="cd-status-name"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commitLabel}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.target.blur()
          if (e.key === 'Escape') setLabel(option.label)
        }}
      />
      <input
        className="cd-status-color"
        type="color"
        value={option.color}
        onChange={(e) => onUpdate({ color: e.target.value })}
        title="Status color"
      />
      <button
        className="cd-icon-btn"
        type="button"
        title="Delete status"
        onClick={onDelete}
      >
        <IconTrash />
      </button>
    </div>
  )
}
