// ─── Graph → Hierarchy tree ──────────────────────────────────────────────
//
// The flowchart is a *directed graph*: cards are nodes, connectors are edges
// pointing from `source_card_id` → `target_card_id`. To "view as hierarchy"
// we walk every outgoing edge starting from one or more selected roots and
// emit a true tree. Real flowcharts contain DAGs (one node feeding several
// children) and sometimes outright cycles (A → B → A); we handle both:
//
//   • cycle  : a node that re-appears on its own ancestor chain. Emitted as
//              a leaf placeholder marked `isCycle` so the recursion can't
//              infinite-loop. Visualised as "⟲ Cycle".
//
//   • multi-parent : a node that has already been emitted somewhere else in
//              the tree (DAG). Two strategies:
//                'mark'      → second appearance is a leaf placeholder
//                              labelled "Already shown ↑". Default.
//                'duplicate' → render a full subtree at every parent
//                              (still safe because cycles are guarded).
//
// All counter-keyed treeIds are unique within one buildHierarchy call so they
// can serve as React keys; cardIds remain available for "click row → focus
// card on canvas" interactions.

export const DEFAULT_HIERARCHY_OPTIONS = {
  duplicateMode: 'mark',     // 'mark' | 'duplicate'
  maxDepth: 200,             // hard guard for malformed input
}

/**
 * @typedef {Object} TreeNode
 * @property {string} id           Unique within this tree (React key)
 * @property {string} cardId       Source card id
 * @property {Object} card         Reference to original card object
 * @property {number} depth        0-based depth from its root
 * @property {TreeNode[]} children
 * @property {boolean} [isAlreadyShown]   true → leaf placeholder (DAG)
 * @property {boolean} [isCycle]          true → leaf placeholder (cycle)
 */

/**
 * @param {Array}  cards       full cards array
 * @param {Array}  connectors  full connectors array
 * @param {string[]} rootIds   selected card ids to use as roots
 * @param {Partial<typeof DEFAULT_HIERARCHY_OPTIONS>} options
 * @returns {TreeNode[]} forest (one tree per root)
 */
export function buildHierarchy(cards, connectors, rootIds, options = {}) {
  const opts = { ...DEFAULT_HIERARCHY_OPTIONS, ...options }
  const cardsById = new Map(cards.map((c) => [c.id, c]))

  // outgoing[sourceId] = [targetId, ...] in connector-creation order
  const outgoing = new Map()
  for (const conn of connectors) {
    if (!cardsById.has(conn.source_card_id) || !cardsById.has(conn.target_card_id)) continue
    if (!outgoing.has(conn.source_card_id)) outgoing.set(conn.source_card_id, [])
    outgoing.get(conn.source_card_id).push(conn.target_card_id)
  }

  // Globally seen cardIds (used by 'mark' mode for multi-parent placeholders).
  const seenGlobal = new Set()
  let counter = 0
  const nextId = () => `tn-${counter++}`

  const build = (cardId, ancestors, depth) => {
    const card = cardsById.get(cardId)
    if (!card) return null
    if (depth > opts.maxDepth) {
      return { id: nextId(), cardId, card, depth, children: [], isCycle: true }
    }
    if (ancestors.has(cardId)) {
      // Back-edge → cycle. Stop here.
      return { id: nextId(), cardId, card, depth, children: [], isCycle: true }
    }
    if (opts.duplicateMode === 'mark' && seenGlobal.has(cardId)) {
      return { id: nextId(), cardId, card, depth, children: [], isAlreadyShown: true }
    }
    seenGlobal.add(cardId)

    const childAncestors = new Set(ancestors).add(cardId)
    const childIds = outgoing.get(cardId) || []
    const children = []
    for (const cid of childIds) {
      const sub = build(cid, childAncestors, depth + 1)
      if (sub) children.push(sub)
    }
    return { id: nextId(), cardId, card, depth, children }
  }

  const roots = []
  // Dedup root ids: if user selected the same card twice (shouldn't happen, but…)
  const uniqRoots = [...new Set(rootIds)]
  for (const id of uniqRoots) {
    const tree = build(id, new Set(), 0)
    if (tree) roots.push(tree)
  }
  return roots
}

/** Walk the tree depth-first and apply visit(node, parent) */
export function walkTree(roots, visit) {
  const go = (n, parent) => {
    visit(n, parent)
    for (const c of n.children) go(c, n)
  }
  for (const r of roots) go(r, null)
}

/** Count nodes (excluding placeholders) in the tree */
export function countTreeCards(roots) {
  let n = 0
  walkTree(roots, (node) => {
    if (!node.isAlreadyShown && !node.isCycle) n++
  })
  return n
}

/** Collect every TreeNode id so "Expand all" can mark them open at once. */
export function collectExpandableIds(roots) {
  const ids = []
  walkTree(roots, (node) => {
    if (node.children.length > 0) ids.push(node.id)
  })
  return ids
}

/**
 * Reachability subgraph from a set of roots.
 *
 * Used for the Dagre / DAG layout — unlike `buildHierarchy` which converts
 * the graph to a strict tree (with "Already shown" / "Cycle" placeholders),
 * Dagre handles multi-parent and acyclic DAGs natively. We simply walk
 * every node reachable along outgoing edges and emit the unique nodes and
 * edges that fall inside the visited set.
 *
 * Self-loops and back-edges of cycles are dropped before handing off to
 * Dagre (it requires a DAG; cycles would throw / mis-layout).
 *
 * @returns {{ nodes: Card[], edges: { id: string, source: string, target: string }[], cyclic: string[][] }}
 *   `cyclic` is the list of edges that were dropped because they'd close
 *   a cycle, so the UI can warn ("3 connectors hidden to keep layout DAG-clean").
 */
export function buildSubgraph(cards, connectors, rootIds) {
  const cardsById = new Map(cards.map((c) => [c.id, c]))
  const outgoing = new Map()
  for (const conn of connectors) {
    if (!cardsById.has(conn.source_card_id) || !cardsById.has(conn.target_card_id)) continue
    if (!outgoing.has(conn.source_card_id)) outgoing.set(conn.source_card_id, [])
    outgoing.get(conn.source_card_id).push(conn)
  }

  // BFS to collect every card reachable from any root.
  const reachable = new Set()
  const queue = []
  for (const id of rootIds) {
    if (cardsById.has(id) && !reachable.has(id)) {
      reachable.add(id)
      queue.push(id)
    }
  }
  while (queue.length) {
    const id = queue.shift()
    for (const conn of outgoing.get(id) || []) {
      if (!reachable.has(conn.target_card_id)) {
        reachable.add(conn.target_card_id)
        queue.push(conn.target_card_id)
      }
    }
  }

  // DFS rank assignment (path-from-root depth); used to detect & drop
  // back-edges that would form cycles. Edges from later-rank → earlier-
  // rank are treated as back-edges.
  const rank = new Map()
  const visited = new Set()
  const onStack = new Set()
  const cyclic = []

  const dfs = (id, depth) => {
    rank.set(id, Math.max(depth, rank.get(id) ?? 0))
    onStack.add(id)
    visited.add(id)
    for (const conn of outgoing.get(id) || []) {
      const t = conn.target_card_id
      if (onStack.has(t)) {
        // Back-edge → cycle; remember and skip.
        cyclic.push([conn.source_card_id, conn.target_card_id])
        continue
      }
      if (!visited.has(t)) dfs(t, depth + 1)
    }
    onStack.delete(id)
  }
  for (const id of rootIds) if (reachable.has(id)) dfs(id, 0)

  const cyclicKeys = new Set(cyclic.map(([s, t]) => `${s}->${t}`))
  const nodes = [...reachable].map((id) => cardsById.get(id))
  const edges = []
  for (const id of reachable) {
    for (const conn of outgoing.get(id) || []) {
      if (!reachable.has(conn.target_card_id)) continue
      if (conn.source_card_id === conn.target_card_id) continue   // self-loop
      const key = `${conn.source_card_id}->${conn.target_card_id}`
      if (cyclicKeys.has(key)) continue
      edges.push({ id: conn.id, source: conn.source_card_id, target: conn.target_card_id })
    }
  }
  return { nodes, edges, cyclic }
}

/**
 * Serialise the tree to a plain JSON-friendly structure for export. We strip
 * runtime-only fields (treeId, depth, refs to original card) and keep the
 * card metadata that matters for downstream tooling.
 */
export function serializeHierarchy(roots) {
  const serializeNode = (n) => ({
    cardId: n.cardId,
    title: n.card?.title || '',
    metadata: {
      node_shape: n.card?.node_shape || 'rect',
      color:      n.card?.color,
      status:     n.card?.status     ?? null,
      assignee:   n.card?.assignee   ?? null,
      tags:       n.card?.tags       || [],
      estimate:   n.card?.estimate   ?? null,
      start_date: n.card?.start_date ?? null,
      end_date:   n.card?.end_date   ?? null,
    },
    placeholder: n.isAlreadyShown ? 'already-shown' : n.isCycle ? 'cycle' : null,
    children: n.children.map(serializeNode),
  })
  return roots.map(serializeNode)
}
