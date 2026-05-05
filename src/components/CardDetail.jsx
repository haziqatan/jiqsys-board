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
  const [settingsExpanded, setSettingsExpanded] = useState(false)
  const [statusManageOpen, setStatusManageOpen] = useState(false)
  const [assigneeManageOpen, setAssigneeManageOpen] = useState(false)
  const [tagManageOpen, setTagManageOpen] = useState(false)

  const nextMode = () => setMode((m) => MODES[(MODES.indexOf(m) + 1) % MODES.length])
  const NextIcon = MODE_ICONS[MODES[(MODES.indexOf(mode) + 1) % MODES.length]]
  const normalizedStatus = normalizeStatus(status)
  const availableStatusOptions = getStatusOptions(normalizedStatus, statusOptions)
  const editableStatusOptions = statusOptions.filter((option) => option.value)
  const selectedTags = tags || []

  const commit = (patch) => onUpdate(patch)
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

      {!settingsExpanded ? (
        <button
          type="button"
          className="cd-settings-collapsed"
          onClick={() => setSettingsExpanded(true)}
          title="Expand settings"
        >
          <SettingsSummary
            color={color}
            barStyle={barStyle}
            status={normalizedStatus}
            statusOptions={statusOptions}
            assignee={assignee}
            assigneeOptions={assigneeOptions}
            tags={selectedTags}
            tagOptions={tagOptions}
            estimate={estimate}
            startDate={startDate}
            endDate={endDate}
          />
          <span className="cd-collapsed-toggle">
            <IconExpandFull />
          </span>
        </button>
      ) : (
        <>
          <div className="cd-settings-header">
            <span>Settings</span>
            <button
              type="button"
              className="cd-section-toggle"
              title="Hide settings"
              onClick={() => setSettingsExpanded(false)}
            >
              <IconCollapse />
            </button>
          </div>

          <div className="cd-settings">
            {/* ── Color & Bar Style — combined into one section ── */}
            <div className="cd-section">
              <div className="cd-section-title">Appearance</div>
              <div className="cd-appearance">
                <div className="cd-appearance-color">
                  <button
                    className="cd-color-swatch"
                    style={{ background: color }}
                    onClick={() => setShowColor((v) => !v)}
                    title="Card color"
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
            </div>

            {/* ── Status ── */}
            <div className="cd-section">
              <div className="cd-section-title">
                <span>Status</span>
                <button
                  type="button"
                  className="cd-manage-btn"
                  onClick={() => setStatusManageOpen((v) => !v)}
                >
                  {statusManageOpen ? 'Done' : 'Manage'}
                </button>
              </div>
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
              {statusManageOpen && (
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

            {/* ── Assignee ── */}
            <div className="cd-section">
              <div className="cd-section-title">
                <span>Assignee</span>
                <button
                  type="button"
                  className="cd-manage-btn"
                  onClick={() => setAssigneeManageOpen((v) => !v)}
                >
                  {assigneeManageOpen ? 'Done' : 'Manage'}
                </button>
              </div>
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
              {assigneeManageOpen && (
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

            {/* ── Tags ── */}
            <div className="cd-section">
              <div className="cd-section-title">
                <span>Tags</span>
                <button
                  type="button"
                  className="cd-manage-btn"
                  onClick={() => setTagManageOpen((v) => !v)}
                >
                  {tagManageOpen ? 'Done' : 'Manage'}
                </button>
              </div>
              <div className="cd-status-picker">
                {tagOptions.length === 0 && !tagManageOpen && (
                  <span className="cd-empty-hint">No tags yet — click Manage to add one.</span>
                )}
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
              {tagManageOpen && (
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

            {/* ── Dates + Estimate — three-column compact row ── */}
            <div className="cd-section">
              <div className="cd-section-title">Schedule & estimate</div>
              <div className="cd-fieldgrid">
                <label className="cd-field">
                  <span>Start</span>
                  <input
                    className="cd-input"
                    type="date"
                    value={startDate || ''}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      commit({ start_date: e.target.value || null })
                    }}
                  />
                </label>
                <label className="cd-field">
                  <span>End</span>
                  <input
                    className="cd-input"
                    type="date"
                    value={endDate || ''}
                    onChange={(e) => {
                      setEndDate(e.target.value)
                      commit({ end_date: e.target.value || null })
                    }}
                  />
                </label>
                <label className="cd-field">
                  <span>Estimate</span>
                  <input
                    className="cd-input"
                    type="number"
                    placeholder="—"
                    value={estimate}
                    onChange={(e) => setEstimate(e.target.value)}
                    onBlur={() => commit({ estimate: estimate === '' ? null : Number(estimate) })}
                  />
                </label>
              </div>
            </div>
          </div>
        </>
      )}

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

// Compact one-line preview of the card's settings shown when the panel
// is collapsed. Only includes facets that have a value, plus a hint when
// nothing is set so the toggle still has something to show.
function SettingsSummary({
  color,
  barStyle,
  status,
  statusOptions,
  assignee,
  assigneeOptions,
  tags,
  tagOptions,
  estimate,
  startDate,
  endDate,
}) {
  const chips = []

  // Color swatch — always shown so users see the active color
  chips.push(
    <span key="color" className="cd-chip cd-chip-color" title="Card color">
      <span className="cd-chip-swatch" style={{ background: color }} />
      <span className={`cd-chip-bar style-${barStyle}`} style={{ backgroundColor: color }} />
    </span>,
  )

  if (status) {
    const opt = statusOptions.find((o) => o.value === status)
    const c = opt?.color || '#cbd0db'
    chips.push(
      <span key="status" className="cd-chip" style={{ '--chip-c': c }} title="Status">
        <span className="cd-chip-dot" style={{ background: c }} />
        {opt?.label || status}
      </span>,
    )
  }

  if (assignee) {
    const opt = assigneeOptions.find((o) => o.value === assignee)
    const c = opt?.color || '#8b5cf6'
    chips.push(
      <span key="assignee" className="cd-chip" style={{ '--chip-c': c }} title="Assignee">
        <span className="cd-chip-dot" style={{ background: c }} />
        @{opt?.label || assignee}
      </span>,
    )
  }

  if (tags && tags.length > 0) {
    const first = tagOptions.find((o) => o.value === tags[0])
    const c = first?.color || '#14b8a6'
    chips.push(
      <span key="tags" className="cd-chip" style={{ '--chip-c': c }} title="Tags">
        <span className="cd-chip-dot" style={{ background: c }} />
        #{first?.label || tags[0]}
        {tags.length > 1 && <span className="cd-chip-extra">+{tags.length - 1}</span>}
      </span>,
    )
  }

  if (estimate !== '' && estimate != null) {
    chips.push(
      <span key="estimate" className="cd-chip cd-chip-muted" title="Estimate">
        {estimate}p
      </span>,
    )
  }

  if (startDate || endDate) {
    const fmt = (d) => (d ? d.slice(5).replace('-', '/') : '—')
    chips.push(
      <span key="dates" className="cd-chip cd-chip-muted" title="Dates">
        {fmt(startDate)} → {fmt(endDate)}
      </span>,
    )
  }

  return <div className="cd-summary">{chips}</div>
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
