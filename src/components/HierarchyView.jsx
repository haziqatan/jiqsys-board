import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildHierarchy,
  collectExpandableIds,
  countTreeCards,
  serializeHierarchy,
} from '../lib/hierarchy'
import { getStatusColor } from '../lib/status'
import { getOptionColor } from '../lib/options'
import { IconClose, IconChevronRight } from './Icons'
import '../styles/HierarchyView.css'

/**
 * Hierarchy view modal.
 *
 * Props
 *   open           boolean
 *   onClose        () => void
 *   cards          full board cards
 *   connectors     full board connectors
 *   rootIds        array of selected card ids → tree roots
 *   onFocusCard    (cardId) => void — pan canvas to the card
 *   statusOptions, assigneeOptions, tagOptions  for colour-coding metadata
 */
export default function HierarchyView({
  open,
  onClose,
  cards,
  connectors,
  rootIds,
  onFocusCard,
  statusOptions = [],
  assigneeOptions = [],
  tagOptions = [],
}) {
  const [showMetadata, setShowMetadata] = useState(true)
  const [duplicateMode, setDuplicateMode] = useState('mark') // 'mark' | 'duplicate'
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [exporting, setExporting] = useState(false)
  const treeRef = useRef(null)

  // Recompute tree when inputs change. Memoised because the recursion can
  // be O(V + E) and the user re-renders on every mouse move otherwise.
  const roots = useMemo(() => {
    if (!open || !rootIds?.length) return []
    return buildHierarchy(cards, connectors, rootIds, { duplicateMode })
  }, [open, cards, connectors, rootIds, duplicateMode])

  const totalCount = useMemo(() => countTreeCards(roots), [roots])

  // Default to expanded everywhere when the tree first builds.
  useEffect(() => {
    if (!open) return
    setExpandedIds(new Set(collectExpandableIds(roots)))
  }, [open, roots])

  // Esc closes the modal.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  // ── Expand / collapse helpers ───────────────────────────────────────
  const toggle = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const expandAll   = () => setExpandedIds(new Set(collectExpandableIds(roots)))
  const collapseAll = () => setExpandedIds(new Set())

  // ── Exports ────────────────────────────────────────────────────────
  const downloadBlob = (blob, name) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }
  const exportJson = () => {
    const data = serializeHierarchy(roots)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `hierarchy-${Date.now()}.json`)
  }
  const exportPng = async () => {
    if (!treeRef.current) return
    setExporting(true)
    try {
      // Lazy-load so it doesn't bloat the initial bundle.
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(treeRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        // Filter out the disclosure buttons — they're interactive & not
        // useful in a static image.
        filter: (node) =>
          !(node.classList && node.classList.contains('hv-row-meta-actions')),
      })
      const blob = await (await fetch(dataUrl)).blob()
      downloadBlob(blob, `hierarchy-${Date.now()}.png`)
    } catch (err) {
      console.error('PNG export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="hv-overlay" onMouseDown={onClose}>
      <div className="hv-modal" onMouseDown={(e) => e.stopPropagation()}>
        <header className="hv-header">
          <div className="hv-title">
            <h2>Hierarchy</h2>
            <span className="hv-subtitle">
              {totalCount === 0
                ? 'Select a node first'
                : `${totalCount} ${totalCount === 1 ? 'node' : 'nodes'}`}
              {roots.length > 1 && ` from ${roots.length} roots`}
            </span>
          </div>
          <div className="hv-header-actions">
            <button className="hv-btn" onClick={expandAll}>Expand all</button>
            <button className="hv-btn" onClick={collapseAll}>Collapse all</button>
            <label className="hv-toggle">
              <input
                type="checkbox"
                checked={showMetadata}
                onChange={(e) => setShowMetadata(e.target.checked)}
              />
              Metadata
            </label>
            <label className="hv-toggle" title="How to handle nodes with multiple parents">
              <select
                value={duplicateMode}
                onChange={(e) => setDuplicateMode(e.target.value)}
              >
                <option value="mark">Multi-parent: mark</option>
                <option value="duplicate">Multi-parent: duplicate</option>
              </select>
            </label>
            <span className="hv-divider" />
            <button className="hv-btn" onClick={exportJson} disabled={!roots.length}>JSON</button>
            <button className="hv-btn" onClick={exportPng} disabled={!roots.length || exporting}>
              {exporting ? 'Exporting…' : 'PNG'}
            </button>
            <button className="hv-icon-btn" onClick={onClose} title="Close (Esc)">
              <IconClose width={14} height={14} />
            </button>
          </div>
        </header>

        <div className="hv-body" ref={treeRef}>
          {roots.length === 0 ? (
            <EmptyState />
          ) : (
            roots.map((root) => (
              <Branch
                key={root.id}
                node={root}
                expandedIds={expandedIds}
                onToggle={toggle}
                showMetadata={showMetadata}
                onFocusCard={onFocusCard}
                statusOptions={statusOptions}
                assigneeOptions={assigneeOptions}
                tagOptions={tagOptions}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Recursive branch ────────────────────────────────────────────────
function Branch({ node, expandedIds, onToggle, ...rest }) {
  const expanded = expandedIds.has(node.id)
  return (
    <>
      <Row node={node} expanded={expanded} onToggle={onToggle} {...rest} />
      {expanded && node.children.length > 0 && (
        <div className="hv-children">
          {node.children.map((child) => (
            <Branch key={child.id} node={child} expandedIds={expandedIds} onToggle={onToggle} {...rest} />
          ))}
        </div>
      )}
    </>
  )
}

// ─── One row ────────────────────────────────────────────────────────
function Row({ node, expanded, onToggle, showMetadata, onFocusCard, statusOptions, assigneeOptions, tagOptions }) {
  const card = node.card
  const hasChildren = node.children.length > 0
  const isPlaceholder = node.isAlreadyShown || node.isCycle

  const handleRowClick = () => {
    if (isPlaceholder) return
    onFocusCard?.(node.cardId)
  }

  return (
    <div
      className={`hv-row${isPlaceholder ? ' placeholder' : ''}${node.isCycle ? ' cycle' : ''}`}
      style={{ paddingLeft: 12 + node.depth * 22 }}
    >
      <button
        type="button"
        className={`hv-disclosure${hasChildren ? '' : ' empty'}${expanded ? ' expanded' : ''}`}
        onClick={() => hasChildren && onToggle(node.id)}
        aria-label={expanded ? 'Collapse' : 'Expand'}
      >
        {hasChildren && <IconChevronRight width={12} height={12} />}
      </button>
      <span className="hv-color-dot" style={{ background: card?.color || '#cbd5e1' }} />
      <button type="button" className="hv-row-title" onClick={handleRowClick} title="Focus on canvas">
        {card?.title || (card?.node_shape === 'text' ? 'Text' : 'Untitled')}
      </button>
      {node.isAlreadyShown && <span className="hv-badge">Already shown ↑</span>}
      {node.isCycle && <span className="hv-badge danger">⟲ Cycle</span>}
      {showMetadata && !isPlaceholder && card && (
        <Metadata
          card={card}
          statusOptions={statusOptions}
          assigneeOptions={assigneeOptions}
          tagOptions={tagOptions}
        />
      )}
    </div>
  )
}

// ─── Metadata pill row ───────────────────────────────────────────────
function Metadata({ card, statusOptions, assigneeOptions, tagOptions }) {
  const statusDot = card.status ? getStatusColor(card.status, statusOptions) : null
  const assigneeDot = card.assignee ? getOptionColor(card.assignee, assigneeOptions) : null
  const tag = card.tags?.[0]
  const tagDot = tag ? getOptionColor(tag, tagOptions) : null
  const dateRange = card.start_date || card.end_date
    ? `${card.start_date || '?'} → ${card.end_date || '?'}`
    : null

  // Strip HTML tags + collapse whitespace for the description preview.
  const previewSrc = card.description?.html || ''
  const previewText = previewSrc
    ? String(previewSrc).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
    : ''

  return (
    <div className="hv-meta">
      {card.status && (
        <span className="hv-pill"><span className="hv-dot" style={{ background: statusDot }} />{card.status}</span>
      )}
      {card.assignee && (
        <span className="hv-pill"><span className="hv-dot" style={{ background: assigneeDot }} />@{card.assignee}</span>
      )}
      {tag && (
        <span className="hv-pill"><span className="hv-dot" style={{ background: tagDot }} />#{tag}{card.tags.length > 1 ? ` +${card.tags.length - 1}` : ''}</span>
      )}
      {card.estimate != null && card.estimate !== '' && (
        <span className="hv-pill">{card.estimate}p</span>
      )}
      {dateRange && (
        <span className="hv-pill">{dateRange}</span>
      )}
      {previewText && (
        <span className="hv-preview" title={previewText}>{previewText}</span>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="hv-empty">
      <div className="hv-empty-title">Nothing to show</div>
      <p>Select one or more cards on the canvas, then open Hierarchy again.</p>
    </div>
  )
}
