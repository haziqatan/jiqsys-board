import { useEffect, useMemo, useRef, useState } from 'react'
import Tree from 'react-d3-tree'
import dagre from 'dagre'
import {
  buildHierarchy,
  buildSubgraph,
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
  // Per-card "full metadata" state. Each card starts in compact preview
  // (title + 2-3 key pills); clicking the chevron on a card flips it to
  // full (every tag, dates, shape, long content preview). Keyed by
  // cardId so the choice carries across the three views and across
  // multi-parent occurrences in tree/indent.
  const [expandedMetaIds, setExpandedMetaIds] = useState(() => new Set())
  const toggleMeta = (cardId) =>
    setExpandedMetaIds((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  const expandAllMeta = () => {
    const ids = new Set()
    for (const c of cards) ids.add(c.id)
    setExpandedMetaIds(ids)
  }
  const collapseAllMeta = () => setExpandedMetaIds(new Set())
  // View mode: "indent" (rows) | "tree" (react-d3-tree) | "dagre" (DAG layout)
  const [viewMode, setViewMode] = useState('indent')
  // Dagre layout direction: TB (top-to-bottom) | LR (left-to-right)
  const [dagreDir, setDagreDir] = useState('TB')
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
            {/* View-mode toggle — Indent (list) | Tree (d3) | Dagre (DAG) */}
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
              <button
                role="tab"
                aria-selected={viewMode === 'dagre'}
                className={`hv-seg-btn${viewMode === 'dagre' ? ' active' : ''}`}
                onClick={() => setViewMode('dagre')}
              >Dagre</button>
            </div>
            {viewMode === 'dagre' && (
              <label className="hv-toggle" title="Dagre layout direction">
                <select value={dagreDir} onChange={(e) => setDagreDir(e.target.value)}>
                  <option value="TB">↓ Top-Bottom</option>
                  <option value="BT">↑ Bottom-Top</option>
                  <option value="LR">→ Left-Right</option>
                  <option value="RL">← Right-Left</option>
                </select>
              </label>
            )}
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
            {showMetadata && (
              <>
                <button className="hv-btn" onClick={expandAllMeta} title="Show full metadata on every card">
                  Show all meta
                </button>
                <button className="hv-btn" onClick={collapseAllMeta} title="Collapse to preview on every card">
                  Hide all meta
                </button>
              </>
            )}
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
          className={`hv-body${viewMode !== 'indent' ? ' hv-body-tree' : ''}`}
          ref={treeRef}
        >
          {(viewMode === 'dagre' ? !rootIds?.length : roots.length === 0) ? (
            <EmptyState />
          ) : viewMode === 'tree' ? (
            <TreeView
              roots={roots}
              showMetadata={showMetadata}
              expandedMetaIds={expandedMetaIds}
              onToggleMeta={toggleMeta}
              onFocusCard={onFocusCard}
              statusOptions={statusOptions}
              assigneeOptions={assigneeOptions}
              tagOptions={tagOptions}
              size={bodySize}
              onMeasure={setBodySize}
            />
          ) : viewMode === 'dagre' ? (
            <DagreView
              cards={cards}
              connectors={connectors}
              rootIds={rootIds}
              direction={dagreDir}
              showMetadata={showMetadata}
              expandedMetaIds={expandedMetaIds}
              onToggleMeta={toggleMeta}
              onFocusCard={onFocusCard}
              statusOptions={statusOptions}
              assigneeOptions={assigneeOptions}
              tagOptions={tagOptions}
            />
          ) : (
            roots.map((root) => (
              <Branch
                key={root.id}
                node={root}
                expandedIds={expandedIds}
                onToggle={toggle}
                showMetadata={showMetadata}
                expandedMetaIds={expandedMetaIds}
                onToggleMeta={toggleMeta}
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
function Row({ node, expanded, onToggle, showMetadata, expandedMetaIds, onToggleMeta, onFocusCard, statusOptions, assigneeOptions, tagOptions }) {
  const card = node.card
  const hasChildren = node.children.length > 0
  const isPlaceholder = node.isAlreadyShown || node.isCycle
  const metaExpanded = card ? expandedMetaIds?.has(card.id) : false

  const handleRowClick = () => {
    if (isPlaceholder) return
    onFocusCard?.(node.cardId)
  }

  return (
    <div
      className={`hv-row${isPlaceholder ? ' placeholder' : ''}${node.isCycle ? ' cycle' : ''}${metaExpanded ? ' meta-expanded' : ''}`}
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
          expanded={metaExpanded}
          onToggle={() => onToggleMeta?.(card.id)}
          statusOptions={statusOptions}
          assigneeOptions={assigneeOptions}
          tagOptions={tagOptions}
        />
      )}
    </div>
  )
}

// ─── Metadata pills row (with per-card preview ⇄ full toggle) ───────
function Metadata({ card, expanded, onToggle, statusOptions, assigneeOptions, tagOptions }) {
  const statusDot   = card.status   ? getStatusColor(card.status, statusOptions)        : null
  const assigneeDot = card.assignee ? getOptionColor(card.assignee, assigneeOptions)    : null
  const allTags     = card.tags     || []
  const dateRange   = card.start_date || card.end_date
    ? `${card.start_date || '?'} → ${card.end_date || '?'}`
    : null

  const html = card.description?.html || ''
  // 1-line plain-text peek for the collapsed state — short signal that
  // there's content; user clicks the chevron to see the full thing.
  const peek = html
    ? String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
    : ''

  // Whether this card has any "extra" metadata that's only worth seeing
  // in the expanded view — drives whether the chevron renders at all.
  const hasExtras =
    allTags.length > 1 ||
    !!dateRange ||
    (card.node_shape && card.node_shape !== 'rect') ||
    !!html ||
    !!card.assignee

  return (
    <div className={`hv-meta${expanded ? ' expanded' : ''}`}>
      {/* ── Always-visible "preview" pills ─────────────────────────── */}
      {card.status && (
        <span className="hv-pill"><span className="hv-dot" style={{ background: statusDot }} />{card.status}</span>
      )}
      {card.assignee && (expanded || allTags.length === 0) && (
        <span className="hv-pill"><span className="hv-dot" style={{ background: assigneeDot }} />@{card.assignee}</span>
      )}
      {!expanded && allTags[0] && (
        <span className="hv-pill">
          <span className="hv-dot" style={{ background: getOptionColor(allTags[0], tagOptions) }} />
          #{allTags[0]}{allTags.length > 1 ? ` +${allTags.length - 1}` : ''}
        </span>
      )}
      {card.estimate != null && card.estimate !== '' && (
        <span className="hv-pill">{card.estimate}p</span>
      )}

      {/* ── Extras (only when expanded) ───────────────────────────── */}
      {expanded && allTags.length > 0 && allTags.map((t) => (
        <span key={t} className="hv-pill">
          <span className="hv-dot" style={{ background: getOptionColor(t, tagOptions) }} />#{t}
        </span>
      ))}
      {expanded && dateRange && (
        <span className="hv-pill">{dateRange}</span>
      )}
      {expanded && card.node_shape && card.node_shape !== 'rect' && (
        <span className="hv-pill subtle">{card.node_shape}</span>
      )}

      {/* ── Description ────────────────────────────────────────────
         Collapsed: 1-line plain peek (just enough to know there's content).
         Expanded:  the FULL TipTap HTML rendered inline so paragraphs,
                    bullet lists, ordered lists, task-list checkboxes, and
                    images all show as their own elements. */}
      {!expanded && peek && (
        <span className="hv-preview" title={peek}>{peek}</span>
      )}
      {expanded && html && (
        <div
          className="hv-rich"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}

      {hasExtras && (
        <button
          type="button"
          className="hv-meta-toggle"
          title={expanded ? 'Show preview only' : 'Show full metadata'}
          aria-label={expanded ? 'Collapse metadata' : 'Expand metadata'}
          onClick={(e) => { e.stopPropagation(); onToggle?.() }}
        >
          {expanded ? '▴' : '▾'}
        </button>
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

function TreeView({ roots, showMetadata, expandedMetaIds, onToggleMeta, onFocusCard, statusOptions, assigneeOptions, tagOptions, size, onMeasure }) {
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

  // If ANY card has its metadata expanded, give every card the larger
  // size so react-d3-tree (which only supports one global node size)
  // has room. Cards in preview mode just have whitespace below.
  const anyMetaExpanded = expandedMetaIds && expandedMetaIds.size > 0
  const showFull = showMetadata && anyMetaExpanded
  const nodeSize = { x: 320, y: !showMetadata ? 120 : showFull ? 320 : 220 }
  const cardW = 280
  const cardH = !showMetadata ? 92 : showFull ? 296 : 196

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
          expandedMetaIds={expandedMetaIds}
          onToggleMeta={onToggleMeta}
          toggleNode={toggleNode}
          onFocusCard={onFocusCard}
          statusOptions={statusOptions}
          assigneeOptions={assigneeOptions}
          tagOptions={tagOptions}
        />
      </foreignObject>
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMetadata, expandedMetaIds, onToggleMeta, statusOptions, assigneeOptions, tagOptions, onFocusCard, cardW, cardH])

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

// ─── Dagre DAG view ─────────────────────────────────────────────────
// Uses dagre to lay out the reachable subgraph from the selected roots,
// then renders an SVG with foreignObject HTML cards and orthogonal
// edges. Multi-parent nodes appear once (true DAG, not a tree).
// Pan with drag, zoom with mouse wheel.

const DAGRE_NODE_W = 280
const DAGRE_NODE_H_FULL = 196
const DAGRE_NODE_H_SLIM = 64

function DagreView({ cards, connectors, rootIds, direction, showMetadata, expandedMetaIds, onToggleMeta, onFocusCard, statusOptions, assigneeOptions, tagOptions }) {
  const containerRef = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  // view = pan/zoom transform applied to the inner <g>
  const [view, setView] = useState({ x: 0, y: 0, scale: 1, fitted: false })
  const panningRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    const measure = () => {
      const r = containerRef.current.getBoundingClientRect()
      setSize({ width: r.width, height: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const layout = useMemo(() => {
    if (!rootIds?.length) return null
    const { nodes, edges, cyclic } = buildSubgraph(cards, connectors, rootIds)
    if (!nodes.length) return null

    const g = new dagre.graphlib.Graph()
    g.setGraph({
      rankdir: direction,
      nodesep: 28,
      ranksep: 56,
      marginx: 24,
      marginy: 24,
    })
    g.setDefaultEdgeLabel(() => ({}))

    // Per-card height: cards with metadata expanded are taller. This
    // re-runs dagre's layout whenever a user toggles a card, so the
    // graph stays cleanly spaced.
    for (const n of nodes) {
      const expanded = !!expandedMetaIds?.has(n.id)
      const h = !showMetadata
        ? DAGRE_NODE_H_SLIM
        : expanded
        ? DAGRE_NODE_H_FULL + 100
        : DAGRE_NODE_H_FULL
      g.setNode(n.id, { width: DAGRE_NODE_W, height: h, card: n, expanded })
    }
    for (const e of edges) g.setEdge(e.source, e.target)
    dagre.layout(g)

    // Bounding box of all node centres (with size) for fit-to-view.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const positioned = []
    for (const id of g.nodes()) {
      const n = g.node(id)
      if (!n) continue
      positioned.push({ id, x: n.x, y: n.y, w: n.width, h: n.height, card: n.card, expanded: n.expanded })
      minX = Math.min(minX, n.x - n.width / 2)
      minY = Math.min(minY, n.y - n.height / 2)
      maxX = Math.max(maxX, n.x + n.width / 2)
      maxY = Math.max(maxY, n.y + n.height / 2)
    }
    const positionedEdges = g.edges().map((e) => {
      const ed = g.edge(e)
      return { id: `${e.v}->${e.w}`, points: ed?.points || [] }
    })
    return {
      nodes: positioned,
      edges: positionedEdges,
      bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
      cyclic,
    }
  }, [cards, connectors, rootIds, direction, showMetadata, expandedMetaIds])

  // Auto-fit the layout to the container the first time we have both
  // sizes available. Subsequent direction changes also re-fit.
  useEffect(() => {
    if (!layout || !size.width) return
    const pad = 40
    const sx = (size.width - pad * 2) / Math.max(1, layout.bbox.w)
    const sy = (size.height - pad * 2) / Math.max(1, layout.bbox.h)
    const scale = Math.min(1, sx, sy)
    setView({
      scale,
      x: (size.width - layout.bbox.w * scale) / 2 - layout.bbox.x * scale,
      y: (size.height - layout.bbox.h * scale) / 2 - layout.bbox.y * scale,
      fitted: true,
    })
  }, [layout, size.width, size.height, direction])

  const onWheel = (e) => {
    e.preventDefault()
    const factor = Math.exp(-e.deltaY * 0.0015)
    setView((v) => {
      const rect = containerRef.current.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const newScale = Math.min(3, Math.max(0.15, v.scale * factor))
      // keep the cursor's world point fixed while zooming
      const wx = (mx - v.x) / v.scale
      const wy = (my - v.y) / v.scale
      return {
        scale: newScale,
        x: mx - wx * newScale,
        y: my - wy * newScale,
        fitted: true,
      }
    })
  }
  const onMouseDown = (e) => {
    // Skip drags that started on a node's clickable bits.
    if (e.target.closest('.hv-tnc-title') || e.target.closest('.hv-tnc-toggle')) return
    panningRef.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
  }
  const onMouseMove = (e) => {
    if (!panningRef.current) return
    setView((v) => ({
      ...v,
      x: panningRef.current.vx + (e.clientX - panningRef.current.x),
      y: panningRef.current.vy + (e.clientY - panningRef.current.y),
    }))
  }
  const onMouseUp = () => { panningRef.current = null }

  if (!layout) {
    return (
      <div ref={containerRef} className="hv-dagre-wrap">
        <EmptyState />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="hv-dagre-wrap"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <svg width="100%" height="100%" className="hv-dagre-svg">
        <defs>
          <marker id="hv-dagre-arrow" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill="var(--text-muted)" />
          </marker>
        </defs>
        <g transform={`translate(${view.x}, ${view.y}) scale(${view.scale})`}>
          {/* Edges first so they sit beneath the cards */}
          {layout.edges.map((e) => (
            <path
              key={e.id}
              d={pointsToPath(e.points)}
              fill="none"
              stroke="var(--border-strong)"
              strokeWidth={1.5}
              markerEnd="url(#hv-dagre-arrow)"
            />
          ))}
          {layout.nodes.map((n) => (
            <foreignObject
              key={n.id}
              x={n.x - n.w / 2}
              y={n.y - n.h / 2}
              width={n.w}
              height={n.h}
              style={{ overflow: 'visible' }}
            >
              <DagreNodeCard
                card={n.card}
                expanded={!!expandedMetaIds?.has(n.card.id)}
                onToggleMeta={onToggleMeta}
                showMetadata={showMetadata}
                onFocusCard={onFocusCard}
                statusOptions={statusOptions}
                assigneeOptions={assigneeOptions}
                tagOptions={tagOptions}
              />
            </foreignObject>
          ))}
        </g>
      </svg>

      {/* Floating mini-toolbar: zoom + reset + cyclic-edges hint */}
      <div className="hv-dagre-controls">
        <button className="hv-icon-btn" title="Zoom out"
          onClick={() => setView((v) => ({ ...v, scale: Math.max(0.15, v.scale / 1.2) }))}>−</button>
        <span className="hv-dagre-zoom">{Math.round(view.scale * 100)}%</span>
        <button className="hv-icon-btn" title="Zoom in"
          onClick={() => setView((v) => ({ ...v, scale: Math.min(3, v.scale * 1.2) }))}>+</button>
        <button className="hv-icon-btn" title="Fit to screen"
          onClick={() => setView((v) => ({ ...v, fitted: false }))} >⊡</button>
        {layout.cyclic.length > 0 && (
          <span className="hv-dagre-warn" title={`Hidden cyclic edges:\n${layout.cyclic.map(([s, t]) => `${s} → ${t}`).join('\n')}`}>
            ⟲ {layout.cyclic.length} hidden
          </span>
        )}
      </div>
    </div>
  )
}

// Convert dagre's edge points into a smooth orthogonal SVG path.
function pointsToPath(points) {
  if (!points || points.length === 0) return ''
  // Use cardinal-spline-style "M / L" for crispness.
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`
  }
  return d
}

// Reuse the same card layout as TreeNodeCard but keyed off a raw card
// (Dagre walks the graph directly — no TreeNode placeholders).
function DagreNodeCard({ card, expanded, onToggleMeta, showMetadata, onFocusCard, statusOptions, assigneeOptions, tagOptions }) {
  if (!card) return null
  return (
    <div className={`hv-tnc${expanded ? ' meta-expanded' : ''}`} style={{ borderTopColor: card.color || 'var(--accent)' }}>
      <div className="hv-tnc-row">
        <span className="hv-color-dot" style={{ background: card.color || '#cbd5e1' }} />
        <button
          type="button"
          className="hv-tnc-title"
          onClick={(e) => { e.stopPropagation(); onFocusCard?.(card.id) }}
          title="Focus on canvas"
        >
          {card.title || (card.node_shape === 'text' ? 'Text' : 'Untitled')}
        </button>
        {showMetadata && (
          <button
            type="button"
            className="hv-tnc-meta-btn"
            title={expanded ? 'Show preview only' : 'Show full metadata'}
            onClick={(e) => { e.stopPropagation(); onToggleMeta?.(card.id) }}
          >
            {expanded ? '▴' : '▾'}
          </button>
        )}
      </div>

      {showMetadata && (
        <CardMetaBody
          card={card}
          expanded={expanded}
          statusOptions={statusOptions}
          assigneeOptions={assigneeOptions}
          tagOptions={tagOptions}
        />
      )}
    </div>
  )
}

// ─── Shared metadata body for Tree + Dagre cards ────────────────────
// Same field selection as the indent <Metadata /> component but laid
// out for a card (vertical stack of rows). Description content is
// rendered via dangerouslySetInnerHTML so bullet lists, numbered lists,
// task-list checkboxes, and images come through as proper elements.
// In collapsed state we show a short plain peek; expanded shows the
// full HTML with the card body acting as a scroll container so very
// long descriptions don't blow out the spatial layout.
function CardMetaBody({ card, expanded, statusOptions, assigneeOptions, tagOptions }) {
  const statusDot   = card.status   ? getStatusColor(card.status, statusOptions)        : null
  const assigneeDot = card.assignee ? getOptionColor(card.assignee, assigneeOptions)    : null
  const allTags     = card.tags     || []
  const dateRange   = card.start_date || card.end_date
    ? `${card.start_date || '?'} → ${card.end_date || '?'}`
    : null
  const html = card.description?.html || ''
  const peek = !expanded && html
    ? String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
    : ''

  return (
    <div className={`hv-tnc-meta${expanded ? ' expanded' : ''}`}>
      <div className="hv-tnc-pills">
        {card.status && (
          <span className="hv-pill"><span className="hv-dot" style={{ background: statusDot }} />{card.status}</span>
        )}
        {(expanded || allTags.length === 0) && card.assignee && (
          <span className="hv-pill"><span className="hv-dot" style={{ background: assigneeDot }} />@{card.assignee}</span>
        )}
        {!expanded && allTags[0] && (
          <span className="hv-pill">
            <span className="hv-dot" style={{ background: getOptionColor(allTags[0], tagOptions) }} />
            #{allTags[0]}{allTags.length > 1 ? ` +${allTags.length - 1}` : ''}
          </span>
        )}
        {card.estimate != null && card.estimate !== '' && (
          <span className="hv-pill">{card.estimate}p</span>
        )}
        {expanded && allTags.map((t) => (
          <span key={t} className="hv-pill">
            <span className="hv-dot" style={{ background: getOptionColor(t, tagOptions) }} />#{t}
          </span>
        ))}
        {expanded && dateRange && (
          <span className="hv-pill">{dateRange}</span>
        )}
        {expanded && card.node_shape && card.node_shape !== 'rect' && (
          <span className="hv-pill subtle">{card.node_shape}</span>
        )}
      </div>

      {peek && (
        <div className="hv-tnc-preview" title={peek}>{peek}</div>
      )}
      {expanded && html && (
        <div
          className="hv-rich hv-tnc-rich"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  )
}

function TreeNodeCard({ datum, showMetadata, expandedMetaIds, onToggleMeta, toggleNode, onFocusCard, statusOptions, assigneeOptions, tagOptions }) {
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

  const metaExpanded = !!expandedMetaIds?.has(card.id)

  return (
    <div className={`hv-tnc${metaExpanded ? ' meta-expanded' : ''}`} style={{ borderTopColor: card.color || 'var(--accent)' }}>
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
        {showMetadata && (
          <button
            type="button"
            className="hv-tnc-meta-btn"
            title={metaExpanded ? 'Show preview only' : 'Show full metadata'}
            onClick={(e) => { e.stopPropagation(); onToggleMeta?.(card.id) }}
          >
            {metaExpanded ? '▴' : '▾'}
          </button>
        )}
        {hasChildren && (
          <button
            type="button"
            className="hv-tnc-toggle"
            title="Collapse / expand subtree"
            onClick={(e) => { e.stopPropagation(); toggleNode() }}
          >
            {datum._children ? '+' : '−'}
          </button>
        )}
      </div>

      {showMetadata && (
        <CardMetaBody
          card={card}
          expanded={metaExpanded}
          statusOptions={statusOptions}
          assigneeOptions={assigneeOptions}
          tagOptions={tagOptions}
        />
      )}
    </div>
  )
}
