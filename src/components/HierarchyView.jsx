import { useEffect, useMemo, useRef, useState } from 'react'
import Tree from 'react-d3-tree'
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

// ─── Adapter: our TreeNode[] → react-d3-tree shape ──────────────────
//   Single root → its tree.   Multiple roots → wrap in a virtual root
//   so react-d3-tree (which only takes one root) can render them all.
function toRd3(node) {
  return {
    name: node.card?.title || 'Untitled',
    attributes: { cardId: node.cardId },
    __tn: node,                     // stash full TreeNode for custom renderer
    children: node.children.map(toRd3),
  }
}
function toRd3Forest(roots) {
  if (roots.length === 0) return null
  if (roots.length === 1) return toRd3(roots[0])
  return {
    name: 'Hierarchy',
    __virtual: true,
    children: roots.map(toRd3),
  }
}

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
  // View mode: "indent" (vertical text rows) | "tree" (spatial via react-d3-tree)
  const [viewMode, setViewMode] = useState('indent')
  // react-d3-tree needs explicit pixel dimensions; we measure the body once
  // it mounts and on resize so the tree centres itself in the visible area.
  const [bodySize, setBodySize] = useState({ width: 0, height: 0 })
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
            {/* View-mode toggle — Indent (compact list) | Tree (spatial) */}
            <div className="hv-segmented" role="tablist">
              <button
                role="tab"
                aria-selected={viewMode === 'indent'}
                className={`hv-seg-btn${viewMode === 'indent' ? ' active' : ''}`}
                onClick={() => setViewMode('indent')}
              >Indent</button>
              <button
                role="tab"
                aria-selected={viewMode === 'tree'}
                className={`hv-seg-btn${viewMode === 'tree' ? ' active' : ''}`}
                onClick={() => setViewMode('tree')}
              >Tree</button>
            </div>
            <span className="hv-divider" />
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

        <div
          className={`hv-body${viewMode === 'tree' ? ' hv-body-tree' : ''}`}
          ref={treeRef}
        >
          {roots.length === 0 ? (
            <EmptyState />
          ) : viewMode === 'tree' ? (
            <TreeView
              roots={roots}
              showMetadata={showMetadata}
              onFocusCard={onFocusCard}
              statusOptions={statusOptions}
              assigneeOptions={assigneeOptions}
              tagOptions={tagOptions}
              size={bodySize}
              onMeasure={setBodySize}
            />
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

// ─── Spatial tree view (react-d3-tree) ──────────────────────────────
// Renders the hierarchy as a top-to-bottom tree with each node drawn as
// an HTML card (via SVG <foreignObject>) so we can show full metadata.
// Supports drag-to-pan, scroll-to-zoom, and click-to-collapse natively
// from the library; we add click-on-title → focus card on canvas.

function TreeView({ roots, showMetadata, onFocusCard, statusOptions, assigneeOptions, tagOptions, size, onMeasure }) {
  const containerRef = useRef(null)
  const data = useMemo(() => toRd3Forest(roots), [roots])

  // Measure container size; react-d3-tree needs explicit dimensions to
  // initially centre the tree. We watch resizes so the tree re-centres
  // when the user resizes the viewport.
  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const measure = () => {
      const rect = el.getBoundingClientRect()
      onMeasure({ width: rect.width, height: rect.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [onMeasure])

  const nodeSize = { x: 320, y: showMetadata ? 220 : 120 }
  const cardW = 280
  // Approximate render height of a node card so the foreignObject crops
  // cleanly. Slight overshoot is fine — overflow is hidden by the card.
  const cardH = showMetadata ? 196 : 92

  // Memoise the renderer so react-d3-tree doesn't unmount nodes between
  // renders (it uses === reference equality on the prop).
  const renderNode = useMemo(() => {
    return ({ nodeDatum, toggleNode }) => (
      <foreignObject
        x={-cardW / 2}
        y={-cardH / 2}
        width={cardW}
        height={cardH}
        style={{ overflow: 'visible' }}
      >
        <TreeNodeCard
          datum={nodeDatum}
          showMetadata={showMetadata}
          toggleNode={toggleNode}
          onFocusCard={onFocusCard}
          statusOptions={statusOptions}
          assigneeOptions={assigneeOptions}
          tagOptions={tagOptions}
        />
      </foreignObject>
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMetadata, statusOptions, assigneeOptions, tagOptions, onFocusCard])

  return (
    <div ref={containerRef} className="hv-tree-wrap">
      {size.width > 0 && data && (
        <Tree
          data={data}
          orientation="vertical"
          pathFunc="step"
          translate={{ x: size.width / 2, y: 80 }}
          nodeSize={nodeSize}
          separation={{ siblings: 1, nonSiblings: 1.2 }}
          collapsible
          zoomable
          renderCustomNodeElement={renderNode}
          // Don't auto-collapse below a depth — user opens an explicit
          // hierarchy view, so showing everything is the expected default.
          initialDepth={Infinity}
        />
      )}
    </div>
  )
}

function TreeNodeCard({ datum, showMetadata, toggleNode, onFocusCard, statusOptions, assigneeOptions, tagOptions }) {
  // Virtual-root marker emitted by toRd3Forest when there are >1 roots —
  // render as a slim label.
  if (datum.__virtual) {
    return (
      <div className="hv-tnc virtual">
        <div className="hv-tnc-title">{datum.name}</div>
        <div className="hv-tnc-meta-line muted">{datum.children?.length} roots</div>
      </div>
    )
  }
  const tn = datum.__tn
  const card = tn?.card
  if (!tn || !card) {
    return <div className="hv-tnc"><div className="hv-tnc-title">{datum.name}</div></div>
  }
  const hasChildren = (datum.children || datum._children)?.length > 0

  if (tn.isAlreadyShown) {
    return (
      <div className="hv-tnc placeholder">
        <div className="hv-tnc-title">{card.title || 'Untitled'}</div>
        <div className="hv-tnc-meta-line">Already shown ↑</div>
      </div>
    )
  }
  if (tn.isCycle) {
    return (
      <div className="hv-tnc placeholder cycle">
        <div className="hv-tnc-title">{card.title || 'Untitled'}</div>
        <div className="hv-tnc-meta-line">⟲ Cycle</div>
      </div>
    )
  }

  const statusDot   = card.status   ? getStatusColor(card.status, statusOptions)        : null
  const assigneeDot = card.assignee ? getOptionColor(card.assignee, assigneeOptions)    : null
  const tag         = card.tags?.[0]
  const tagDot      = tag ? getOptionColor(tag, tagOptions)                              : null
  const dateRange   = card.start_date || card.end_date
    ? `${card.start_date || '?'} → ${card.end_date || '?'}`
    : null
  const previewText = card.description?.html
    ? String(card.description.html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 110)
    : ''

  return (
    <div className="hv-tnc" style={{ borderTopColor: card.color || 'var(--accent)' }}>
      <div className="hv-tnc-row">
        <span className="hv-color-dot" style={{ background: card.color || '#cbd5e1' }} />
        <button
          type="button"
          className="hv-tnc-title"
          onClick={(e) => { e.stopPropagation(); onFocusCard?.(tn.cardId) }}
          title="Focus on canvas"
        >
          {card.title || (card.node_shape === 'text' ? 'Text' : 'Untitled')}
        </button>
        {hasChildren && (
          <button
            type="button"
            className="hv-tnc-toggle"
            title="Collapse / expand"
            onClick={(e) => { e.stopPropagation(); toggleNode() }}
          >
            {datum._children ? '+' : '−'}
          </button>
        )}
      </div>

      {showMetadata && (
        <div className="hv-tnc-meta">
          {card.status && (
            <span className="hv-pill"><span className="hv-dot" style={{ background: statusDot }} />{card.status}</span>
          )}
          {card.assignee && (
            <span className="hv-pill"><span className="hv-dot" style={{ background: assigneeDot }} />@{card.assignee}</span>
          )}
          {tag && (
            <span className="hv-pill">
              <span className="hv-dot" style={{ background: tagDot }} />
              #{tag}{card.tags.length > 1 ? ` +${card.tags.length - 1}` : ''}
            </span>
          )}
          {card.estimate != null && card.estimate !== '' && (
            <span className="hv-pill">{card.estimate}p</span>
          )}
          {dateRange && (
            <span className="hv-pill">{dateRange}</span>
          )}
          {card.node_shape && card.node_shape !== 'rect' && (
            <span className="hv-pill subtle">{card.node_shape}</span>
          )}
          {previewText && (
            <div className="hv-tnc-preview" title={previewText}>{previewText}</div>
          )}
        </div>
      )}
    </div>
  )
}
