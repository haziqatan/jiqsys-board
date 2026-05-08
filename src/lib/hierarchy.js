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
