import { useEffect, useState } from 'react'
import RichTextEditor from './RichTextEditor'
import ColorPicker from './ColorPicker'
import {
  IconClose,
  IconTrash,
  IconPanelLeft,
  IconModal,
  IconExpandFull,
  IconPlus,
  IconCollapse,
} from './Icons'
import { getStatusOptions, normalizeStatus } from '../lib/status'
import { getOptionColor, normalizeOption } from '../lib/options'
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
  assigneeOptions,
  tagOptions,
  onUpdate,
  onCreateStatus,
  onUpdateStatus,
  onDeleteStatus,
  onCreateAssignee,
  onUpdateAssignee,
  onDeleteAssignee,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
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
  const [newAssignee, setNewAssignee] = useState('')
  const [newAssigneeColor, setNewAssigneeColor] = useState('#8b5cf6')
  const [newTag, setNewTag] = useState('')
  const [newTagColor, setNewTagColor] = useState('#14b8a6')
  const [expandedSections, setExpandedSections] = useState({
    status: false,
    assignee: false,
    tags: false,
  })

  const nextMode = () => setMode((m) => MODES[(MODES.indexOf(m) + 1) % MODES.length])
  const NextIcon = MODE_ICONS[MODES[(MODES.indexOf(mode) + 1) % MODES.length]]
  const normalizedStatus = normalizeStatus(status)
  const availableStatusOptions = getStatusOptions(normalizedStatus, statusOptions)
  const editableStatusOptions = statusOptions.filter((option) => option.value)
  const selectedTags = tags || []

  const commit = (patch) => onUpdate(patch)
  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }
  const createAndSelectStatus = () => {
    const option = onCreateStatus(newStatus, newStatusColor)
    if (!option) return
    setNewStatus('')
    setStatus(option.value)
    commit({ status: option.value })
  }
  const createAndSelectAssignee = () => {
    const option = onCreateAssignee(newAssignee, newAssigneeColor)
    if (!option) return
    setNewAssignee('')
    setAssignee(option.value)
    commit({ assignee: option.value })
  }
  const createAndToggleTag = () => {
    const option = onCreateTag(newTag, newTagColor)
    if (!option) return
    setNewTag('')
    const nextTags = selectedTags.includes(option.value)
      ? selectedTags
      : [...selectedTags, option.value]
    setTags(nextTags)
    commit({ tags: nextTags })
  }
  const toggleTag = (tag) => {
    const nextTags = selectedTags.includes(tag)
      ? selectedTags.filter((item) => item !== tag)
      : [...selectedTags, tag]
    setTags(nextTags)
    commit({ tags: nextTags })
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
        <div className="cd-row-label">
          <label>Status</label>
          <SectionToggle
            expanded={expandedSections.status}
            onClick={() => toggleSection('status')}
            label="status"
          />
        </div>
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
          {expandedSections.status && (
            <OptionLibrary
              options={editableStatusOptions}
              selected={(option) => normalizedStatus === option.value}
              addPlaceholder="New status"
              newValue={newStatus}
              newColor={newStatusColor}
              onNewValue={setNewStatus}
              onNewColor={setNewStatusColor}
              onAdd={createAndSelectStatus}
              onSelect={(option) => { setStatus(option.value); commit({ status: option.value }) }}
              onUpdate={(option, patch) => {
                const nextStatus = onUpdateStatus(option.id, patch)
                if (normalizedStatus === option.value && nextStatus) {
                  setStatus(nextStatus)
                  commit({ status: nextStatus })
                }
                return nextStatus
              }}
              onDelete={(option) => {
                if (normalizedStatus === option.value) {
                  setStatus(null)
                  commit({ status: null })
                }
                onDeleteStatus(option.id)
              }}
            />
          )}
        </div>
      </div>

      <div className="cd-row">
        <div className="cd-row-label">
          <label>Assignee</label>
          <SectionToggle
            expanded={expandedSections.assignee}
            onClick={() => toggleSection('assignee')}
            label="assignee"
          />
        </div>
        <div className="cd-status-control">
          <div className="cd-status-picker">
            <button
              type="button"
              className={`cd-status-pill${!assignee ? ' active' : ''}`}
              onClick={() => { setAssignee(''); commit({ assignee: null }) }}
              style={!assignee ? { '--pill-c': '#cbd0db' } : undefined}
            >
              <span className="cd-status-dot" style={{ background: '#cbd0db' }} />
              Not set
            </button>
            {assigneeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`cd-status-pill${assignee === option.value ? ' active' : ''}`}
                onClick={() => { setAssignee(option.value); commit({ assignee: option.value }) }}
                style={assignee === option.value ? { '--pill-c': option.color } : undefined}
              >
                <span className="cd-status-dot" style={{ background: option.color }} />
                @{option.label}
              </button>
            ))}
          </div>
          {expandedSections.assignee && (
            <OptionLibrary
              options={assigneeOptions}
              selected={(option) => assignee === option.value}
              addPlaceholder="New assignee"
              newValue={newAssignee}
              newColor={newAssigneeColor}
              onNewValue={setNewAssignee}
              onNewColor={setNewAssigneeColor}
              onAdd={createAndSelectAssignee}
              onSelect={(option) => { setAssignee(option.value); commit({ assignee: option.value }) }}
              onUpdate={(option, patch) => {
                const nextAssignee = onUpdateAssignee(option.id, patch)
                if (assignee === option.value && nextAssignee) {
                  setAssignee(nextAssignee)
                  commit({ assignee: nextAssignee })
                }
                return nextAssignee
              }}
              onDelete={(option) => {
                if (assignee === option.value) {
                  setAssignee('')
                  commit({ assignee: null })
                }
                onDeleteAssignee(option.id)
              }}
            />
          )}
        </div>
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
        <div className="cd-row-label">
          <label>Tags</label>
          <SectionToggle
            expanded={expandedSections.tags}
            onClick={() => toggleSection('tags')}
            label="tags"
          />
        </div>
        <div className="cd-status-control">
          <div className="cd-status-picker">
            {tagOptions.map((option) => {
              const active = selectedTags.includes(option.value)
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`cd-status-pill${active ? ' active' : ''}`}
                  onClick={() => toggleTag(option.value)}
                  style={active ? { '--pill-c': option.color } : undefined}
                >
                  <span className="cd-status-dot" style={{ background: option.color }} />
                  #{option.label}
                </button>
              )
            })}
          </div>
          {expandedSections.tags && (
            <OptionLibrary
              options={tagOptions}
              selected={(option) => selectedTags.includes(option.value)}
              addPlaceholder="New tag"
              newValue={newTag}
              newColor={newTagColor}
              onNewValue={setNewTag}
              onNewColor={setNewTagColor}
              onAdd={createAndToggleTag}
              onSelect={(option) => toggleTag(option.value)}
              onUpdate={(option, patch) => {
                const nextTag = onUpdateTag(option.id, patch)
                if (selectedTags.includes(option.value) && nextTag) {
                  const nextTags = [...new Set(selectedTags.map((tag) => (
                    tag === option.value ? nextTag : tag
                  )))]
                  setTags(nextTags)
                  commit({ tags: nextTags })
                }
                return nextTag
              }}
              onDelete={(option) => {
                if (selectedTags.includes(option.value)) {
                  const nextTags = selectedTags.filter((tag) => tag !== option.value)
                  setTags(nextTags)
                  commit({ tags: nextTags })
                }
                onDeleteTag(option.id)
              }}
            />
          )}
        </div>
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

function SectionToggle({ expanded, onClick, label }) {
  const ToggleIcon = expanded ? IconCollapse : IconExpandFull
  return (
    <button
      type="button"
      className="cd-section-toggle"
      title={`${expanded ? 'Minimize' : 'Full'} ${label}`}
      onClick={onClick}
    >
      <ToggleIcon />
    </button>
  )
}

function OptionLibrary({
  options,
  selected,
  addPlaceholder,
  newValue,
  newColor,
  onNewValue,
  onNewColor,
  onAdd,
  onSelect,
  onUpdate,
  onDelete,
}) {
  return (
    <>
      <div className="cd-status-library">
        {options.map((option) => (
          <OptionEditor
            key={option.id}
            option={option}
            selected={selected(option)}
            onSelect={() => onSelect(option)}
            onUpdate={(patch) => onUpdate(option, patch)}
            onDelete={() => onDelete(option)}
          />
        ))}
      </div>
      <div className="cd-status-add">
        <input
          className="cd-input"
          placeholder={addPlaceholder}
          value={newValue}
          onChange={(e) => onNewValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onAdd()
          }}
        />
        <input
          className="cd-status-color"
          type="color"
          value={newColor}
          onChange={(e) => onNewColor(e.target.value)}
          title="Color"
        />
        <button
          className="cd-icon-btn"
          type="button"
          title="Add"
          onClick={onAdd}
        >
          <IconPlus />
        </button>
      </div>
    </>
  )
}

function OptionEditor({ option, selected, onSelect, onUpdate, onDelete }) {
  const [label, setLabel] = useState(option.label)

  useEffect(() => {
    setLabel(option.label)
  }, [option.label])

  const commitLabel = () => {
    const nextLabel = normalizeOption(label)
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
        title="Apply"
        onClick={onSelect}
      >
        <span style={{ background: getOptionColor(option.value, [option]) }} />
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
        title="Color"
      />
      <button
        className="cd-icon-btn"
        type="button"
        title="Delete"
        onClick={onDelete}
      >
        <IconTrash />
      </button>
    </div>
  )
}
