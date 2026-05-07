import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// ─── Constants ─────────────────────────────────────────────────────────
const TABLE_ROW_H = 34
const TABLE_MIN_W = 200
const TABLE_MIN_H = 100
const COLUMN_GROW = 120

const TYPES = [
  { id: 'text',         label: 'Text',         glyph: 'T' },
  { id: 'number',       label: 'Number',       glyph: '#' },
  { id: 'select',       label: 'Select',       glyph: '◉' },
  { id: 'multi-select', label: 'Multi-select', glyph: '☰' },
  { id: 'date',         label: 'Date',         glyph: '⌧' },
  { id: 'checkbox',     label: 'Checkbox',     glyph: '☑' },
  { id: 'url',          label: 'URL',          glyph: '↗' },
  { id: 'email',        label: 'Email',        glyph: '@' },
  { id: 'phone',        label: 'Phone',        glyph: '☎' },
]
const TYPE_GLYPH = TYPES.reduce((m, t) => (m[t.id] = t.glyph, m), {})

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9', '#84cc16']

// ─── Default value per column type ─────────────────────────────────────
const defaultCellValue = (type) => {
  switch (type) {
    case 'checkbox':     return false
    case 'multi-select': return []
    default:             return ''
  }
}

// ─── Coerce a value when its column type changes ──────────────────────
const coerceValue = (v, newType) => {
  switch (newType) {
    case 'checkbox':
      if (typeof v === 'boolean') return v
      return !!v && v !== '' && v !== '0' && v !== 'false'
    case 'number': {
      if (v === '' || v == null) return ''
      const n = parseFloat(typeof v === 'string' ? v.replace(/<[^>]+>/g, '') : v)
      return Number.isFinite(n) ? String(n) : ''
    }
    case 'multi-select': {
      if (Array.isArray(v)) return v
      if (!v) return []
      const stripped = typeof v === 'string' ? v.replace(/<[^>]+>/g, '').trim() : String(v)
      return stripped ? [stripped] : []
    }
    case 'select': {
      if (Array.isArray(v)) return v[0] || ''
      if (!v) return ''
      return typeof v === 'string' ? v.replace(/<[^>]+>/g, '').trim() : String(v)
    }
    default:
      return v ?? ''
  }
}

// ─── Migration: old { headers, rows: string[][] } → { columns, rows } ──
function normalizeTable(t) {
  if (!t) {
    return {
      columns: [
        { name: 'Column 1', type: 'text' },
        { name: 'Column 2', type: 'text' },
      ],
      rows: [['', ''], ['', '']],
    }
  }
  if (Array.isArray(t.columns)) return t
  if (Array.isArray(t.headers)) {
    return {
      columns: t.headers.map((h) => ({ name: h, type: 'text' })),
      rows: t.rows || [],
    }
  }
  return t
}

const nextOptionColor = (options) => PALETTE[(options?.length || 0) % PALETTE.length]

// ─── Main component ────────────────────────────────────────────────────
export default function TableNode({ card, onDescriptionChange, onResize }) {
  const tableData = useMemo(() => normalizeTable(card.description?.table), [card.description])
  const columns = tableData.columns
  const rows    = tableData.rows

  const [menuForCol, setMenuForCol] = useState(null)   // column index whose ⋯ menu is open
  const headerCellRefs = useRef([])

  const commitTable = (next) => onDescriptionChange({ table: next })

  // ─ Column ops ─────────────────────────────────────────────────────
  const updateColumn = (cIdx, patch) => {
    commitTable({
      columns: columns.map((c, i) => (i === cIdx ? { ...c, ...patch } : c)),
      rows,
    })
  }
  const insertColumn = (atIdx) => {
    const newCol = { name: `Column ${columns.length + 1}`, type: 'text' }
    commitTable({
      columns: [...columns.slice(0, atIdx), newCol, ...columns.slice(atIdx)],
      rows: rows.map((r) => [...r.slice(0, atIdx), defaultCellValue('text'), ...r.slice(atIdx)]),
    })
    onResize(card.width + COLUMN_GROW, card.height)
  }
  const duplicateColumn = (cIdx) => {
    const dup = { ...columns[cIdx], name: `${columns[cIdx].name} copy` }
    commitTable({
      columns: [...columns.slice(0, cIdx + 1), dup, ...columns.slice(cIdx + 1)],
      rows: rows.map((r) => [...r.slice(0, cIdx + 1), r[cIdx], ...r.slice(cIdx + 1)]),
    })
    onResize(card.width + COLUMN_GROW, card.height)
  }
  const deleteColumn = (cIdx) => {
    if (columns.length <= 1) return
    commitTable({
      columns: columns.filter((_, i) => i !== cIdx),
      rows: rows.map((r) => r.filter((_, i) => i !== cIdx)),
    })
    onResize(Math.max(TABLE_MIN_W, card.width - COLUMN_GROW), card.height)
  }
  const changeColumnType = (cIdx, nextType) => {
    const prev = columns[cIdx]
    const updated = { name: prev.name, type: nextType }
    if (nextType === 'select' || nextType === 'multi-select') {
      updated.options = prev.options || []
    }
    commitTable({
      columns: columns.map((c, i) => (i === cIdx ? updated : c)),
      rows: rows.map((r) => r.map((v, i) => (i === cIdx ? coerceValue(v, nextType) : v))),
    })
  }

  // ─ Row ops ────────────────────────────────────────────────────────
  const addRow = () => {
    commitTable({
      columns,
      rows: [...rows, columns.map((c) => defaultCellValue(c.type))],
    })
    onResize(card.width, card.height + TABLE_ROW_H)
  }
  const deleteRow = (rIdx) => {
    if (rows.length <= 1) return
    commitTable({ columns, rows: rows.filter((_, i) => i !== rIdx) })
    onResize(card.width, Math.max(TABLE_MIN_H, card.height - TABLE_ROW_H))
  }

  // ─ Cell op ────────────────────────────────────────────────────────
  const updateCell = (rIdx, cIdx, value) => {
    commitTable({
      columns,
      rows: rows.map((r, i) =>
        i === rIdx ? r.map((c, j) => (j === cIdx ? value : c)) : r,
      ),
    })
  }

  // ─ Add an option to a select / multi-select column on the fly ─────
  const addOption = (cIdx, label) => {
    const col = columns[cIdx]
    const options = col.options || []
    if (options.find((o) => o.label === label)) return options
    const next = [...options, { label, color: nextOptionColor(options) }]
    updateColumn(cIdx, { options: next })
    return next
  }

  return (
    <div className="card-inner table-inner">
      <table className="cn-table">
        <colgroup>
          {columns.map((_, i) => (
            <col key={i} style={{ width: `calc((100% - 28px) / ${columns.length})` }} />
          ))}
          <col style={{ width: '28px' }} />
        </colgroup>

        <thead>
          <tr>
            {columns.map((col, i) => (
              <ColumnHeader
                key={i}
                ref={(el) => (headerCellRefs.current[i] = el)}
                column={col}
                onRename={(v) => updateColumn(i, { name: v })}
                onOpenMenu={() => setMenuForCol(i)}
                menuOpen={menuForCol === i}
              />
            ))}
            <th className="cn-table-add-col">
              <button
                type="button"
                title="Add column"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); insertColumn(columns.length) }}
              >+</button>
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {row.map((cell, cIdx) => (
                <CellEditor
                  key={cIdx}
                  column={columns[cIdx]}
                  value={cell}
                  onCommit={(v) => updateCell(rIdx, cIdx, v)}
                  onAddOption={(label) => addOption(cIdx, label)}
                />
              ))}
              <td className="cn-table-row-actions">
                {rows.length > 1 && (
                  <button
                    type="button"
                    title="Delete row"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); deleteRow(rIdx) }}
                  >×</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr>
            <td colSpan={columns.length + 1} className="cn-table-add-row">
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); addRow() }}
              >+ Add row</button>
            </td>
          </tr>
        </tfoot>
      </table>

      {menuForCol !== null && (
        <ColumnMenu
          anchorEl={headerCellRefs.current[menuForCol]}
          column={columns[menuForCol]}
          canDelete={columns.length > 1}
          onClose={() => setMenuForCol(null)}
          onChangeType={(t)   => { changeColumnType(menuForCol, t); setMenuForCol(null) }}
          onInsertLeft={()    => { insertColumn(menuForCol);     setMenuForCol(null) }}
          onInsertRight={()   => { insertColumn(menuForCol + 1); setMenuForCol(null) }}
          onDuplicate={()     => { duplicateColumn(menuForCol);  setMenuForCol(null) }}
          onDelete={()        => { deleteColumn(menuForCol);     setMenuForCol(null) }}
        />
      )}
    </div>
  )
}

// ─── Column header (name + type glyph + ⋯ menu trigger) ───────────────
const ColumnHeader = forwardRef(function ColumnHeader(
  { column, onRename, onOpenMenu, menuOpen },
  ref,
) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(column.name)
    const inputRef = useRef(null)

    useEffect(() => { if (!editing) setDraft(column.name) }, [column.name, editing])
    useEffect(() => {
      if (editing && inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    }, [editing])

    const commit = () => {
      setEditing(false)
      const next = draft.trim() || column.name
      if (next !== column.name) onRename(next)
    }

    return (
      <th
        ref={ref}
        className={`cn-table-cell cn-table-th${menuOpen ? ' menu-open' : ''}`}
      >
        <div className="cn-th-inner">
          <span className="cn-th-glyph" title={column.type}>{TYPE_GLYPH[column.type] || 'T'}</span>
          {editing ? (
            <input
              ref={inputRef}
              className="cn-th-name-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit() }
                if (e.key === 'Escape') { setDraft(column.name); setEditing(false) }
                if (e.key === 'Tab') { e.preventDefault(); commit() }
              }}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="cn-th-name"
              onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
            >
              {column.name || ' '}
            </span>
          )}
          <button
            type="button"
            className="cn-th-menu-btn"
            title="Column options"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onOpenMenu() }}
          >⋯</button>
        </div>
      </th>
    )
  })

// ─── Column context menu (popover) ────────────────────────────────────
function ColumnMenu({ anchorEl, column, canDelete, onClose, onChangeType, onInsertLeft, onInsertRight, onDuplicate, onDelete }) {
  const menuRef = useRef(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [typeSubOpen, setTypeSubOpen] = useState(false)

  useLayoutEffect(() => {
    if (!anchorEl) return
    const r = anchorEl.getBoundingClientRect()
    setPos({ x: r.left, y: r.bottom + 4 })
  }, [anchorEl])

  useEffect(() => {
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [onClose])

  return createPortal(
    <div
      className="cn-col-menu"
      ref={menuRef}
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className={`cn-col-menu-item has-sub${typeSubOpen ? ' sub-open' : ''}`}
        onMouseEnter={() => setTypeSubOpen(true)}
        onMouseLeave={() => setTypeSubOpen(false)}
      >
        <span className="cn-col-menu-glyph">{TYPE_GLYPH[column.type]}</span>
        <span className="cn-col-menu-label">Change type</span>
        <span className="cn-col-menu-current">{TYPES.find((t) => t.id === column.type)?.label}</span>
        <span className="cn-col-menu-chev">›</span>
        {typeSubOpen && (
          <div className="cn-col-submenu">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`cn-col-menu-item type-row${t.id === column.type ? ' active' : ''}`}
                onClick={(e) => { e.stopPropagation(); onChangeType(t.id) }}
              >
                <span className="cn-col-menu-glyph">{t.glyph}</span>
                <span className="cn-col-menu-label">{t.label}</span>
                {t.id === column.type && <span className="cn-col-menu-check">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="cn-col-menu-sep" />

      <button type="button" className="cn-col-menu-item" onClick={onInsertLeft}>
        <span className="cn-col-menu-glyph">←</span>
        <span className="cn-col-menu-label">Insert left</span>
      </button>
      <button type="button" className="cn-col-menu-item" onClick={onInsertRight}>
        <span className="cn-col-menu-glyph">→</span>
        <span className="cn-col-menu-label">Insert right</span>
      </button>
      <button type="button" className="cn-col-menu-item" onClick={onDuplicate}>
        <span className="cn-col-menu-glyph">⎘</span>
        <span className="cn-col-menu-label">Duplicate property</span>
      </button>

      <div className="cn-col-menu-sep" />

      <button
        type="button"
        className="cn-col-menu-item danger"
        onClick={onDelete}
        disabled={!canDelete}
      >
        <span className="cn-col-menu-glyph">🗑</span>
        <span className="cn-col-menu-label">Delete property</span>
      </button>
    </div>,
    document.body,
  )
}

// ─── Cell editor — dispatches to the right type ───────────────────────
function CellEditor({ column, value, onCommit, onAddOption }) {
  switch (column.type) {
    case 'number':       return <NumberCell      value={value} onCommit={onCommit} />
    case 'checkbox':     return <CheckboxCell    value={value} onCommit={onCommit} />
    case 'date':         return <DateCell        value={value} onCommit={onCommit} />
    case 'url':          return <LinkCell        value={value} onCommit={onCommit} kind="url" />
    case 'email':        return <LinkCell        value={value} onCommit={onCommit} kind="email" />
    case 'phone':        return <LinkCell        value={value} onCommit={onCommit} kind="phone" />
    case 'select':       return <SelectCell      value={value} onCommit={onCommit} options={column.options || []} onAddOption={onAddOption} />
    case 'multi-select': return <MultiSelectCell value={value} onCommit={onCommit} options={column.options || []} onAddOption={onAddOption} />
    default:             return <TextCell        value={value} onCommit={onCommit} />
  }
}

// ─── TEXT cell — contentEditable with Enter→newline + Cmd+B/I/U ──────
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'SPAN', 'P'])
function sanitizeCellHtml(node) {
  if (!node) return ''
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT)
  const toUnwrap = []
  let cur = walker.nextNode()
  while (cur) {
    if (!ALLOWED_TAGS.has(cur.tagName)) toUnwrap.push(cur)
    else for (const a of [...cur.attributes]) {
      if (a.name === 'style') continue
      cur.removeAttribute(a.name)
    }
    cur = walker.nextNode()
  }
  for (const el of toUnwrap) {
    while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el)
    el.parentNode.removeChild(el)
  }
  return node.innerHTML
}

function TextCell({ value, onCommit }) {
  const [editing, setEditing] = useState(false)
  const editRef = useRef(null)

  useEffect(() => {
    if (!editing) return
    const el = editRef.current
    if (!el) return
    el.innerHTML = value || ''
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el); range.collapse(false)
    const sel = window.getSelection()
    sel.removeAllRanges(); sel.addRange(range)
  }, [editing])  // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => {
    if (!editing) return
    const next = sanitizeCellHtml(editRef.current)
    setEditing(false)
    if (next !== (value || '')) onCommit(next)
  }
  const exec = (cmd) => { try { document.execCommand(cmd, false) } catch {} editRef.current?.focus() }

  if (editing) {
    return (
      <td className="cn-table-cell editing">
        <div className="cn-cell-toolbar" onMouseDown={(e) => e.preventDefault()}>
          <button type="button" title="Bold (⌘B)" onClick={() => exec('bold')}><b>B</b></button>
          <button type="button" title="Italic (⌘I)" onClick={() => exec('italic')}><i>I</i></button>
          <button type="button" title="Underline (⌘U)" onClick={() => exec('underline')}><u>U</u></button>
        </div>
        <div
          ref={editRef}
          className="cn-table-input"
          contentEditable
          suppressContentEditableWarning
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); setEditing(false) }
            else if (e.key === 'Tab') { e.preventDefault(); commit() }
            else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit() }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          spellCheck={false}
        />
      </td>
    )
  }
  return (
    <td className="cn-table-cell" onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}>
      <div className="cn-table-cell-content" dangerouslySetInnerHTML={{ __html: value || '' }} />
    </td>
  )
}

// ─── NUMBER cell ──────────────────────────────────────────────────────
function NumberCell({ value, onCommit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const inputRef = useRef(null)

  useEffect(() => { if (!editing) setDraft(value || '') }, [value, editing])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const commit = () => {
    setEditing(false)
    const trimmed = String(draft).trim()
    if (trimmed === '') { if (value !== '') onCommit(''); return }
    const n = parseFloat(trimmed)
    const next = Number.isFinite(n) ? String(n) : ''
    if (next !== (value || '')) onCommit(next)
  }
  if (editing) {
    return (
      <td className="cn-table-cell number-cell editing">
        <input
          ref={inputRef}
          className="cn-table-input cn-input-num"
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { setDraft(value || ''); setEditing(false) }
            if (e.key === 'Tab') { e.preventDefault(); commit() }
          }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </td>
    )
  }
  return (
    <td className="cn-table-cell number-cell" onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}>
      <div className="cn-table-cell-content number">{value || ''}</div>
    </td>
  )
}

// ─── CHECKBOX cell ────────────────────────────────────────────────────
function CheckboxCell({ value, onCommit }) {
  const checked = !!value
  return (
    <td className="cn-table-cell checkbox-cell"
      onClick={(e) => { e.stopPropagation(); onCommit(!checked) }}
    >
      <div className="cn-checkbox" data-checked={checked ? 'true' : 'false'}>
        {checked && <span className="cn-checkbox-mark">✓</span>}
      </div>
    </td>
  )
}

// ─── DATE cell ────────────────────────────────────────────────────────
function DateCell({ value, onCommit }) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef(null)
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const display = value
    ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : ''

  if (editing) {
    return (
      <td className="cn-table-cell date-cell editing">
        <input
          ref={inputRef}
          className="cn-table-input"
          type="date"
          value={value || ''}
          onChange={(e) => onCommit(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); setEditing(false) }
            if (e.key === 'Escape') setEditing(false)
          }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </td>
    )
  }
  return (
    <td className="cn-table-cell date-cell" onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}>
      <div className="cn-table-cell-content">{display}</div>
    </td>
  )
}

// ─── URL / EMAIL / PHONE cell ─────────────────────────────────────────
function LinkCell({ value, onCommit, kind }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const inputRef = useRef(null)
  useEffect(() => { if (!editing) setDraft(value || '') }, [value, editing])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const commit = () => {
    setEditing(false)
    if (draft !== (value || '')) onCommit(draft)
  }
  const href = !value ? null
    : kind === 'email' ? `mailto:${value}`
    : kind === 'phone' ? `tel:${value}`
    : value.match(/^https?:\/\//i) ? value : `https://${value}`

  if (editing) {
    return (
      <td className="cn-table-cell link-cell editing">
        <input
          ref={inputRef}
          className="cn-table-input"
          type={kind === 'email' ? 'email' : kind === 'phone' ? 'tel' : 'url'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { setDraft(value || ''); setEditing(false) }
            if (e.key === 'Tab') { e.preventDefault(); commit() }
          }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </td>
    )
  }
  return (
    <td className="cn-table-cell link-cell" onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}>
      <div className="cn-table-cell-content">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" onMouseDown={(e) => e.stopPropagation()}>{value}</a>
        ) : ''}
      </div>
    </td>
  )
}

// ─── SELECT cell ──────────────────────────────────────────────────────
function SelectCell({ value, onCommit, options, onAddOption }) {
  const [open, setOpen] = useState(false)
  const tdRef = useRef(null)
  const popRef = useRef(null)
  const [pos, setPos] = useState({ x: 0, y: 0, w: 160 })
  const [filter, setFilter] = useState('')

  useLayoutEffect(() => {
    if (!open || !tdRef.current) return
    const r = tdRef.current.getBoundingClientRect()
    setPos({ x: r.left, y: r.bottom + 2, w: Math.max(160, r.width) })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (popRef.current && !popRef.current.contains(e.target) &&
          tdRef.current && !tdRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [open])

  const selected = options.find((o) => o.label === value)
  const filtered = options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase()))
  const canCreate = filter.trim() && !options.find((o) => o.label.toLowerCase() === filter.trim().toLowerCase())

  const choose = (label) => {
    onCommit(label)
    setFilter('')
    setOpen(false)
  }
  const create = () => {
    const label = filter.trim()
    if (!label) return
    onAddOption(label)
    onCommit(label)
    setFilter('')
    setOpen(false)
  }

  return (
    <td
      ref={tdRef}
      className="cn-table-cell select-cell"
      onClick={(e) => { e.stopPropagation(); setOpen(true) }}
    >
      <div className="cn-table-cell-content">
        {selected && <SelectPill option={selected} />}
      </div>
      {open && createPortal(
        <div
          ref={popRef}
          className="cn-select-pop"
          style={{ left: pos.x, top: pos.y, width: pos.w }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            className="cn-select-search"
            placeholder="Search or create…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); canCreate ? create() : (filtered[0] && choose(filtered[0].label)) }
              if (e.key === 'Escape') setOpen(false)
            }}
          />
          <div className="cn-select-list">
            {filtered.map((o) => (
              <button
                key={o.label}
                type="button"
                className={`cn-select-row${o.label === value ? ' active' : ''}`}
                onClick={(e) => { e.stopPropagation(); choose(o.label) }}
              >
                <SelectPill option={o} />
                {o.label === value && <span className="cn-select-check">✓</span>}
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                className="cn-select-row create"
                onClick={(e) => { e.stopPropagation(); create() }}
              >
                <span>+ Create</span>
                <SelectPill option={{ label: filter.trim(), color: nextOptionColor(options) }} />
              </button>
            )}
            {value && (
              <button
                type="button"
                className="cn-select-row danger"
                onClick={(e) => { e.stopPropagation(); onCommit(''); setOpen(false) }}
              >Clear</button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </td>
  )
}

// ─── MULTI-SELECT cell ────────────────────────────────────────────────
function MultiSelectCell({ value, onCommit, options, onAddOption }) {
  const arr = Array.isArray(value) ? value : []
  const [open, setOpen] = useState(false)
  const tdRef = useRef(null)
  const popRef = useRef(null)
  const [pos, setPos] = useState({ x: 0, y: 0, w: 160 })
  const [filter, setFilter] = useState('')

  useLayoutEffect(() => {
    if (!open || !tdRef.current) return
    const r = tdRef.current.getBoundingClientRect()
    setPos({ x: r.left, y: r.bottom + 2, w: Math.max(180, r.width) })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (popRef.current && !popRef.current.contains(e.target) &&
          tdRef.current && !tdRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [open])

  const filtered = options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase()))
  const canCreate = filter.trim() && !options.find((o) => o.label.toLowerCase() === filter.trim().toLowerCase())

  const toggle = (label) => {
    const next = arr.includes(label) ? arr.filter((v) => v !== label) : [...arr, label]
    onCommit(next)
  }
  const create = () => {
    const label = filter.trim()
    if (!label) return
    onAddOption(label)
    onCommit([...arr, label])
    setFilter('')
  }

  return (
    <td
      ref={tdRef}
      className="cn-table-cell multi-cell"
      onClick={(e) => { e.stopPropagation(); setOpen(true) }}
    >
      <div className="cn-table-cell-content cn-multi-pills">
        {arr.map((label) => {
          const opt = options.find((o) => o.label === label) || { label, color: '#9ca3af' }
          return <SelectPill key={label} option={opt} />
        })}
      </div>
      {open && createPortal(
        <div
          ref={popRef}
          className="cn-select-pop"
          style={{ left: pos.x, top: pos.y, width: pos.w }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            className="cn-select-search"
            placeholder="Search or create…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); canCreate && create() }
              if (e.key === 'Escape') setOpen(false)
            }}
          />
          <div className="cn-select-list">
            {filtered.map((o) => (
              <button
                key={o.label}
                type="button"
                className={`cn-select-row${arr.includes(o.label) ? ' active' : ''}`}
                onClick={(e) => { e.stopPropagation(); toggle(o.label) }}
              >
                <SelectPill option={o} />
                {arr.includes(o.label) && <span className="cn-select-check">✓</span>}
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                className="cn-select-row create"
                onClick={(e) => { e.stopPropagation(); create() }}
              >
                <span>+ Create</span>
                <SelectPill option={{ label: filter.trim(), color: nextOptionColor(options) }} />
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </td>
  )
}

function SelectPill({ option }) {
  if (!option?.label) return null
  return (
    <span
      className="cn-select-pill"
      style={{ background: hexToSoftBg(option.color), color: option.color, borderColor: hexToBorder(option.color) }}
    >
      {option.label}
    </span>
  )
}

// Lighten a hex color by mixing toward white for the pill background.
function hexToSoftBg(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, 0.14)`
}
function hexToBorder(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, 0.35)`
}
