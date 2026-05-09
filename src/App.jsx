import { useEffect, useRef, useState, useCallback } from 'react'
import Canvas from './components/Canvas'
import Toolbar from './components/Toolbar'
import CardDetail from './components/CardDetail'
import BoardMenu from './components/BoardMenu'
import SearchBar from './components/SearchBar'
import HierarchyView from './components/HierarchyView'
import {
  ensureBoard,
  fetchCards,
  fetchConnectors,
  createCard,
  updateCard,
  deleteCard,
  createConnector,
  updateConnector,
  deleteConnector,
  listBoards,
  createBoard,
  renameBoard,
  deleteBoard,
} from './lib/db'
import { DEFAULT_BOARD_ID, supabase } from './lib/supabase'
import {
  BUGS_STATUS_VALUE,
  DEFAULT_STATUS_OPTIONS,
  createStatusOption,
  normalizeStatus,
} from './lib/status'
import { createOption, loadOptions, normalizeOption, saveOptions } from './lib/options'
import './App.css'

const isDetailCard = (card) => (card?.node_shape || 'rect') === 'rect'
const ACTIVE_BOARD_KEY = 'jiqsys-active-board'
const STATUS_OPTIONS_KEY = 'jiqsys-status-options'
const ASSIGNEE_OPTIONS_KEY = 'jiqsys-assignee-options'
const TAG_OPTIONS_KEY = 'jiqsys-tag-options'

function loadStatusOptions() {
  const bugsDefaultOption = DEFAULT_STATUS_OPTIONS.find((option) => option.value === BUGS_STATUS_VALUE)
  const ensureBugsStatusOption = (options) => {
    const merged = [...options]
    if (
      bugsDefaultOption &&
      !merged.some((item) => item.value?.toLowerCase() === BUGS_STATUS_VALUE.toLowerCase())
    ) {
      merged.push(bugsDefaultOption)
    }
    return merged
  }

  try {
    const saved = JSON.parse(localStorage.getItem(STATUS_OPTIONS_KEY) || 'null')
    if (Array.isArray(saved) && saved.length > 0) {
      return [
        DEFAULT_STATUS_OPTIONS[0],
        ...ensureBugsStatusOption(saved.reduce((options, item) => {
          const option = createStatusOption(item.label || item.value, item.color)
          if (option) options.push({ ...option, id: item.id || option.id })
          return options
        }, [])),
      ]
    }
  } catch {
    localStorage.removeItem(STATUS_OPTIONS_KEY)
  }
  return DEFAULT_STATUS_OPTIONS
}

export default function App() {
  const [boards, setBoards] = useState([])
  const [boardId, setBoardId] = useState(() => {
    return localStorage.getItem(ACTIVE_BOARD_KEY) || DEFAULT_BOARD_ID
  })
  const [cards, setCards] = useState([])
  const [connectors, setConnectors] = useState([])
  // Multi-select: array of currently-selected card ids. Holding Shift
  // while clicking a card toggles it in/out of this list; a plain click
  // replaces the list with that single id; clicking empty canvas clears.
  const [selectedIds, setSelectedIds] = useState([])
  const [detailId, setDetailId] = useState(null)
  const [tool, setTool] = useState('select')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusOptions, setStatusOptions] = useState(loadStatusOptions)
  const [assigneeOptions, setAssigneeOptions] = useState(() => loadOptions(ASSIGNEE_OPTIONS_KEY))
  const [tagOptions, setTagOptions] = useState(() => loadOptions(TAG_OPTIONS_KEY))
  const [searchOpen, setSearchOpen] = useState(false)
  const [hierarchyOpen, setHierarchyOpen] = useState(false)
  const [objectClipboard, setObjectClipboard] = useState(null)
  // Bumped each time the user navigates to a new search hit. Canvas listens
  // to this and animates the view to centre the focused card; we use an
  // incrementing token so re-clicking the same result still re-pans.
  const [focusRequest, setFocusRequest] = useState({ id: null, token: 0 })

  // Per-card write batching state. Local updates are applied instantly for
  // smooth dragging/resizing; the actual Supabase write is debounced so we
  // don't fire 60+ writes per second, and a recent-write window lets us
  // ignore realtime echoes that would otherwise snap a dragged card backward.
  const writeStateRef = useRef(new Map())

  useEffect(() => {
    const editable = statusOptions.filter((option) => option.value)
    localStorage.setItem(STATUS_OPTIONS_KEY, JSON.stringify(editable))
  }, [statusOptions])
  useEffect(() => saveOptions(ASSIGNEE_OPTIONS_KEY, assigneeOptions), [assigneeOptions])
  useEffect(() => saveOptions(TAG_OPTIONS_KEY, tagOptions), [tagOptions])

  useEffect(() => {
    setAssigneeOptions((prev) => mergeMissingOptions(prev, cards.map((card) => card.assignee)))
    setTagOptions((prev) => mergeMissingOptions(prev, cards.flatMap((card) => card.tags || [])))
    setStatusOptions((prev) => mergeMissingOptions(prev, cards.map((card) => card.status)))
  }, [cards])

  // Persist active board
  useEffect(() => {
    if (boardId) localStorage.setItem(ACTIVE_BOARD_KEY, boardId)
  }, [boardId])

  // Keyboard shortcuts:
  //   Cmd/Ctrl+F → toggle search bar (intercepts browser's find)
  //   Cmd/Ctrl+H → toggle hierarchy view of current selection
  useEffect(() => {
    const isTyping = (el) =>
      el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    const onKey = (e) => {
      if (isTyping(e.target)) return
      if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault()
        setHierarchyOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleFocusCard = useCallback((id) => {
    setFocusRequest((prev) => ({ id, token: prev.token + 1 }))
    setSelectedIds([id])
  }, [])

  // Browser pinch-zoom prevention
  useEffect(() => {
    const preventBrowserPinchZoom = (event) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault()
    }
    const preventGestureZoom = (event) => event.preventDefault()
    document.addEventListener('wheel', preventBrowserPinchZoom, { passive: false })
    document.addEventListener('gesturestart', preventGestureZoom, { passive: false })
    document.addEventListener('gesturechange', preventGestureZoom, { passive: false })
    return () => {
      document.removeEventListener('wheel', preventBrowserPinchZoom)
      document.removeEventListener('gesturestart', preventGestureZoom)
      document.removeEventListener('gesturechange', preventGestureZoom)
    }
  }, [])

  // Load board list
  const refreshBoards = useCallback(async () => {
    try {
      const bs = await listBoards()
      setBoards(bs)
      // If active board no longer exists, fall back to first available
      if (bs.length > 0 && !bs.find((b) => b.id === boardId)) {
        setBoardId(bs[0].id)
      }
      return bs
    } catch (e) {
      setError(e.message)
      return []
    }
  }, [boardId])

  // Initial load: ensure default board exists, then list all boards
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await ensureBoard(boardId)
        const bs = await listBoards()
        if (cancelled) return
        setBoards(bs)
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load cards/connectors whenever boardId changes
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSelectedIds([])
    setDetailId(null)
    ;(async () => {
      try {
        await ensureBoard(boardId)
        const [c, conns] = await Promise.all([
          fetchCards(boardId),
          fetchConnectors(boardId),
        ])
        if (cancelled) return
        setCards(c)
        setConnectors(conns)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [boardId])

  // Realtime subscription scoped to current board
  useEffect(() => {
    const channel = supabase
      .channel(`board:${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards', filter: `board_id=eq.${boardId}` },
        (payload) => {
          setCards((prev) => {
            if (payload.eventType === 'INSERT') {
              if (prev.find((c) => c.id === payload.new.id)) return prev
              return [...prev, payload.new]
            }
            if (payload.eventType === 'UPDATE') {
              // Echo guard: when WE just wrote this card (or have a write in
              // flight / queued), the realtime echo would clobber whatever
              // newer position the user has dragged to since. Skip it — our
              // local optimistic state is more recent.
              const state = writeStateRef.current.get(payload.new.id)
              if (state) {
                const recentlyFlushed =
                  state.lastFlushAt && Date.now() - state.lastFlushAt < 1000
                if (state.timeout || state.pending || state.latestPatch || recentlyFlushed) {
                  return prev
                }
              }
              return prev.map((c) => (c.id === payload.new.id ? { ...c, ...payload.new } : c))
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((c) => c.id !== payload.old.id)
            }
            return prev
          })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connectors', filter: `board_id=eq.${boardId}` },
        (payload) => {
          setConnectors((prev) => {
            if (payload.eventType === 'INSERT') {
              if (prev.find((c) => c.id === payload.new.id)) return prev
              return [...prev, payload.new]
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((c) => (c.id === payload.new.id ? { ...c, ...payload.new } : c))
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((c) => c.id !== payload.old.id)
            }
            return prev
          })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [boardId])

  // ── Board handlers ──
  const handleCreateBoard = useCallback(async () => {
    try {
      const b = await createBoard('Untitled board')
      setBoards((prev) => [...prev, b])
      setBoardId(b.id)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  const handleRenameBoard = useCallback(async (id, name) => {
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b)))
    try {
      await renameBoard(id, name)
    } catch (e) {
      console.error(e)
      await refreshBoards()
    }
  }, [refreshBoards])

  const handleDeleteBoard = useCallback(async (id) => {
    const remaining = boards.filter((b) => b.id !== id)
    setBoards(remaining)
    if (id === boardId && remaining.length > 0) {
      setBoardId(remaining[0].id)
    }
    try {
      await deleteBoard(id)
    } catch (e) {
      console.error(e)
      await refreshBoards()
    }
  }, [boards, boardId, refreshBoards])

  // ── Card / connector handlers ──
  const handleCreateCard = useCallback(
    async (x, y, overrides = {}) => {
      const card = await createCard(boardId, {
        title: 'New card',
        color: '#3b82f6',
        x,
        y,
        width: 240,
        height: 100,
        ...overrides,
      })
      setCards((prev) => [...prev.filter((c) => c.id !== card.id), card])
      setSelectedIds([card.id])
      return card
    },
    [boardId],
  )

  // Flush the pending merged patch for a card to Supabase.
  const flushCardWrite = useCallback((id) => {
    const state = writeStateRef.current.get(id)
    if (!state || !state.latestPatch) return
    const patch = state.latestPatch
    state.latestPatch = null
    state.timeout = null
    state.pending = true
    updateCard(id, patch)
      .catch((e) => console.error(e))
      .finally(() => {
        state.pending = false
        state.lastFlushAt = Date.now()
      })
  }, [])

  const handleUpdateCard = useCallback((id, patch) => {
    // 1) Optimistic local state update — instant, smooth visual feedback.
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))

    // 2) Debounced DB write — coalesce rapid updates (drag/resize) into a
    //    single trailing write, with a max-wait so long continuous drags
    //    still persist progress periodically.
    let state = writeStateRef.current.get(id)
    if (!state) {
      state = { latestPatch: null, timeout: null, pending: false, lastFlushAt: 0, firstQueuedAt: 0 }
      writeStateRef.current.set(id, state)
    }
    state.latestPatch = { ...(state.latestPatch || {}), ...patch }
    if (!state.firstQueuedAt) state.firstQueuedAt = Date.now()

    if (state.timeout) clearTimeout(state.timeout)

    // Force a flush if this update window has been open for >500ms — keeps
    // long drags from losing all progress if the user closes the tab.
    if (Date.now() - state.firstQueuedAt > 500) {
      state.firstQueuedAt = 0
      flushCardWrite(id)
    } else {
      state.timeout = setTimeout(() => {
        state.firstQueuedAt = 0
        flushCardWrite(id)
      }, 140)
    }
  }, [flushCardWrite])

  // Flush all pending writes when unmounting (e.g. on navigation away).
  useEffect(() => {
    const writes = writeStateRef.current
    return () => {
      for (const [id, state] of writes.entries()) {
        if (state.timeout) {
          clearTimeout(state.timeout)
          state.timeout = null
        }
        if (state.latestPatch) {
          const patch = state.latestPatch
          state.latestPatch = null
          updateCard(id, patch).catch((e) => console.error(e))
        }
      }
    }
  }, [])

  const updateCardsWithStatus = useCallback(async (fromStatus, toStatus) => {
    const affected = cards.filter((card) => card.status === fromStatus)
    if (affected.length === 0) return

    setCards((prev) =>
      prev.map((card) => (card.status === fromStatus ? { ...card, status: toStatus } : card)),
    )
    await Promise.all(
      affected.map((card) => updateCard(card.id, { status: toStatus }).catch(console.error)),
    )
  }, [cards])

  const handleCreateStatus = useCallback((label, color) => {
    const option = createStatusOption(label, color)
    if (!option) return null
    const exists = statusOptions.find(
      (item) => item.value?.toLowerCase() === option.value.toLowerCase(),
    )
    if (exists) return exists

    setStatusOptions((prev) => [...prev, option])
    return option
  }, [statusOptions])

  const handleUpdateStatus = useCallback((id, patch) => {
    const current = statusOptions.find((option) => option.id === id)
    if (!current) return null
    const nextLabel = patch.label != null ? normalizeStatus(patch.label) : current.label
    const nextColor = patch.color || current.color
    if (!nextLabel) return null
    const duplicate = statusOptions.find(
      (option) => option.id !== id && option.value?.toLowerCase() === nextLabel.toLowerCase(),
    )
    if (duplicate) return null

    const rename = nextLabel !== current.value ? { from: current.value, to: nextLabel } : null
    setStatusOptions((prev) =>
      prev.map((option) =>
        option.id === id
          ? { ...option, label: nextLabel, value: nextLabel, color: nextColor }
          : option,
      ),
    )
    if (rename) updateCardsWithStatus(rename.from, rename.to)
    return rename?.to || null
  }, [statusOptions, updateCardsWithStatus])

  const handleDeleteStatus = useCallback((id) => {
    const option = statusOptions.find((item) => item.id === id)
    if (!option?.value) return
    setStatusOptions((prev) => prev.filter((item) => item.id !== id))
    updateCardsWithStatus(option.value, null)
  }, [statusOptions, updateCardsWithStatus])

  const updateCardsWithAssignee = useCallback(async (fromAssignee, toAssignee) => {
    const affected = cards.filter((card) => card.assignee === fromAssignee)
    if (affected.length === 0) return

    setCards((prev) =>
      prev.map((card) =>
        card.assignee === fromAssignee ? { ...card, assignee: toAssignee } : card,
      ),
    )
    await Promise.all(
      affected.map((card) => updateCard(card.id, { assignee: toAssignee }).catch(console.error)),
    )
  }, [cards])

  const updateCardsWithTag = useCallback(async (fromTag, toTag) => {
    const affected = cards.filter((card) => card.tags?.includes(fromTag))
    if (affected.length === 0) return

    setCards((prev) =>
      prev.map((card) => {
        if (!card.tags?.includes(fromTag)) return card
        const nextTags = toTag
          ? [...new Set(card.tags.map((tag) => (tag === fromTag ? toTag : tag)))]
          : card.tags.filter((tag) => tag !== fromTag)
        return { ...card, tags: nextTags }
      }),
    )
    await Promise.all(
      affected.map((card) => {
        const nextTags = toTag
          ? [...new Set(card.tags.map((tag) => (tag === fromTag ? toTag : tag)))]
          : card.tags.filter((tag) => tag !== fromTag)
        return updateCard(card.id, { tags: nextTags }).catch(console.error)
      }),
    )
  }, [cards])

  const handleCreateAssignee = useCallback((label, color) => {
    return createLibraryOption(label, color, assigneeOptions, setAssigneeOptions)
  }, [assigneeOptions])

  const handleUpdateAssignee = useCallback((id, patch) => {
    return updateLibraryOption(id, patch, assigneeOptions, setAssigneeOptions, updateCardsWithAssignee)
  }, [assigneeOptions, updateCardsWithAssignee])

  const handleDeleteAssignee = useCallback((id) => {
    const option = assigneeOptions.find((item) => item.id === id)
    if (!option?.value) return
    setAssigneeOptions((prev) => prev.filter((item) => item.id !== id))
    updateCardsWithAssignee(option.value, null)
  }, [assigneeOptions, updateCardsWithAssignee])

  const handleCreateTag = useCallback((label, color) => {
    return createLibraryOption(label, color, tagOptions, setTagOptions)
  }, [tagOptions])

  const handleUpdateTag = useCallback((id, patch) => {
    return updateLibraryOption(id, patch, tagOptions, setTagOptions, updateCardsWithTag)
  }, [tagOptions, updateCardsWithTag])

  const handleDeleteTag = useCallback((id) => {
    const option = tagOptions.find((item) => item.id === id)
    if (!option?.value) return
    setTagOptions((prev) => prev.filter((item) => item.id !== id))
    updateCardsWithTag(option.value, null)
  }, [tagOptions, updateCardsWithTag])

  const handleDeleteCard = useCallback(
    async (id) => {
      setCards((prev) => prev.filter((c) => c.id !== id))
      setConnectors((prev) =>
        prev.filter((c) => c.source_card_id !== id && c.target_card_id !== id),
      )
      if (detailId === id) setDetailId(null)
      setSelectedIds((prev) => prev.filter((x) => x !== id))
      try {
        await deleteCard(id)
      } catch (e) {
        console.error(e)
      }
    },
    [detailId],
  )

  const handleCreateConnector = useCallback(
    async (sourceId, targetId, opts = {}) => {
      if (!sourceId || !targetId || sourceId === targetId) return null
      const exists = connectors.find(
        (c) => c.source_card_id === sourceId && c.target_card_id === targetId,
      )
      if (exists) return null
      const conn = await createConnector(boardId, sourceId, targetId, opts)
      setConnectors((prev) => [...prev.filter((c) => c.id !== conn.id), conn])
      return conn
    },
    [boardId, connectors],
  )

  const handleUpdateConnector = useCallback(async (id, patch) => {
    setConnectors((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
    try {
      await updateConnector(id, patch)
    } catch (e) {
      console.error(e)
    }
  }, [])

  const handleDeleteConnector = useCallback(async (id) => {
    setConnectors((prev) => prev.filter((c) => c.id !== id))
    try {
      await deleteConnector(id)
    } catch (e) {
      console.error(e)
    }
  }, [])

  // ── Undo history ──────────────────────────────────────────────────────
  // Per-session stack of inverse operations. Each user-visible action
  // (create/delete/update of a card or connector) records an entry; Cmd/Ctrl+Z
  // pops the latest and reverts it. Rapid bursts of updates to the same
  // target (drags, resizes, typing) are merged into a single entry whose
  // before-state captures the field values *before* the burst started.
  const HISTORY_MAX = 200
  const HISTORY_DEBOUNCE_MS = 700
  const historyRef = useRef([])
  const openWindowsRef = useRef(new Map()) // key -> { entry, timeoutId }
  const cardsRef = useRef(cards)
  const connectorsRef = useRef(connectors)
  useEffect(() => { cardsRef.current = cards }, [cards])
  useEffect(() => { connectorsRef.current = connectors }, [connectors])

  const closeAllWindows = useCallback(() => {
    for (const w of openWindowsRef.current.values()) {
      if (w.timeoutId) clearTimeout(w.timeoutId)
    }
    openWindowsRef.current.clear()
  }, [])

  const pushHistory = useCallback((entry) => {
    historyRef.current.push(entry)
    if (historyRef.current.length > HISTORY_MAX) historyRef.current.shift()
  }, [])

  // Open a new entry for `key`, or extend the existing window. `before` is
  // the snapshot of the fields about to change *as of the first call in the
  // window*. Subsequent calls only add fields that weren't already captured.
  const openOrExtendWindow = useCallback((key, type, id, before) => {
    const existing = openWindowsRef.current.get(key)
    if (!existing) {
      const entry = { type, id, before: { ...before } }
      pushHistory(entry)
      openWindowsRef.current.set(key, {
        entry,
        timeoutId: setTimeout(
          () => openWindowsRef.current.delete(key),
          HISTORY_DEBOUNCE_MS,
        ),
      })
    } else {
      clearTimeout(existing.timeoutId)
      existing.timeoutId = setTimeout(
        () => openWindowsRef.current.delete(key),
        HISTORY_DEBOUNCE_MS,
      )
      for (const k of Object.keys(before)) {
        if (!(k in existing.entry.before)) existing.entry.before[k] = before[k]
      }
    }
  }, [pushHistory])

  // Tracked wrappers — same signatures as the primitives, plus history side-effect.
  const trackedCreateCard = useCallback(async (x, y, overrides = {}) => {
    closeAllWindows()
    const card = await handleCreateCard(x, y, overrides)
    if (card) pushHistory({ type: 'createCard', cardId: card.id })
    return card
  }, [handleCreateCard, closeAllWindows, pushHistory])

  const trackedDeleteCard = useCallback(async (id) => {
    closeAllWindows()
    const card = cardsRef.current.find((c) => c.id === id)
    const conns = connectorsRef.current.filter(
      (c) => c.source_card_id === id || c.target_card_id === id,
    )
    if (card) {
      pushHistory({
        type: 'deleteCard',
        card: structuredClone(card),
        connectors: conns.map((c) => structuredClone(c)),
      })
    }
    return handleDeleteCard(id)
  }, [handleDeleteCard, closeAllWindows, pushHistory])

  const trackedUpdateCard = useCallback((id, patch) => {
    const card = cardsRef.current.find((c) => c.id === id)
    if (card) {
      const before = {}
      for (const k of Object.keys(patch)) before[k] = card[k]
      openOrExtendWindow(`card:${id}`, 'updateCard', id, before)
    }
    return handleUpdateCard(id, patch)
  }, [handleUpdateCard, openOrExtendWindow])

  const trackedCreateConnector = useCallback(async (sourceId, targetId, opts) => {
    closeAllWindows()
    const conn = await handleCreateConnector(sourceId, targetId, opts)
    if (conn) pushHistory({ type: 'createConnector', connectorId: conn.id })
    return conn
  }, [handleCreateConnector, closeAllWindows, pushHistory])

  const trackedDeleteConnector = useCallback(async (id) => {
    closeAllWindows()
    const conn = connectorsRef.current.find((c) => c.id === id)
    if (conn) pushHistory({ type: 'deleteConnector', connector: structuredClone(conn) })
    return handleDeleteConnector(id)
  }, [handleDeleteConnector, closeAllWindows, pushHistory])

  const trackedUpdateConnector = useCallback((id, patch) => {
    const conn = connectorsRef.current.find((c) => c.id === id)
    if (conn) {
      const before = {}
      for (const k of Object.keys(patch)) before[k] = conn[k]
      openOrExtendWindow(`conn:${id}`, 'updateConnector', id, before)
    }
    return handleUpdateConnector(id, patch)
  }, [handleUpdateConnector, openOrExtendWindow])

  // Apply one history entry's inverse. All branches use the *primitive*
  // handlers / db calls so the undo itself is not re-recorded.
  const applyUndo = useCallback(async (entry) => {
    if (!entry) return
    switch (entry.type) {
      case 'createCard': {
        await handleDeleteCard(entry.cardId)
        break
      }
      case 'deleteCard': {
        const card = entry.card
        // Optimistic local restore
        setCards((prev) => [...prev.filter((c) => c.id !== card.id), card])
        if (entry.connectors.length > 0) {
          setConnectors((prev) => [
            ...prev.filter((c) => !entry.connectors.some((ec) => ec.id === c.id)),
            ...entry.connectors,
          ])
        }
        // Persist with original ids preserved
        const { created_at: _ca, updated_at: _ua, ...cardInsert } = card
        try { await createCard(card.board_id, cardInsert) } catch (e) { console.error(e) }
        await Promise.all(entry.connectors.map((c) => {
          const { created_at: _cca, updated_at: _cua, source_card_id, target_card_id, board_id, ...rest } = c
          return createConnector(board_id, source_card_id, target_card_id, { id: c.id, ...rest })
            .catch((e) => console.error(e))
        }))
        break
      }
      case 'updateCard': {
        handleUpdateCard(entry.id, entry.before)
        break
      }
      case 'createConnector': {
        await handleDeleteConnector(entry.connectorId)
        break
      }
      case 'deleteConnector': {
        const conn = entry.connector
        setConnectors((prev) => [...prev.filter((c) => c.id !== conn.id), conn])
        const { created_at: _ca, updated_at: _ua, source_card_id, target_card_id, board_id, ...rest } = conn
        try {
          await createConnector(board_id, source_card_id, target_card_id, { id: conn.id, ...rest })
        } catch (e) {
          console.error(e)
        }
        break
      }
      case 'updateConnector': {
        await handleUpdateConnector(entry.id, entry.before)
        break
      }
      default:
        console.warn('Unknown history entry type:', entry.type)
    }
  }, [handleDeleteCard, handleDeleteConnector, handleUpdateCard, handleUpdateConnector])

  const undo = useCallback(() => {
    closeAllWindows()
    const entry = historyRef.current.pop()
    if (!entry) return
    applyUndo(entry)
  }, [closeAllWindows, applyUndo])

  // Cmd/Ctrl+Z → undo. Skip when typing in inputs/textareas/contentEditable
  // so the browser's native input-undo still works for text fields.
  useEffect(() => {
    const isTyping = (el) =>
      el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.shiftKey) return // reserve Cmd+Shift+Z for redo (not implemented yet)
      if (e.key !== 'z' && e.key !== 'Z') return
      if (isTyping(e.target)) return
      e.preventDefault()
      undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])

  // Reset history when switching boards — entries reference ids that won't
  // exist on the other board.
  useEffect(() => {
    historyRef.current = []
    closeAllWindows()
  }, [boardId, closeAllWindows])

  const detailCard = detailId ? cards.find((c) => c.id === detailId) : null
  const visibleDetailCard = isDetailCard(detailCard) ? detailCard : null

  return (
    <div className="app">
      <BoardMenu
        boards={boards}
        currentId={boardId}
        onSwitch={setBoardId}
        onCreate={handleCreateBoard}
        onRename={handleRenameBoard}
        onDelete={handleDeleteBoard}
      />

      {visibleDetailCard && (
        <CardDetail
          key={visibleDetailCard.id}
          card={visibleDetailCard}
          statusOptions={statusOptions}
          assigneeOptions={assigneeOptions}
          tagOptions={tagOptions}
          onUpdate={(patch) => trackedUpdateCard(visibleDetailCard.id, patch)}
          onCreateStatus={handleCreateStatus}
          onUpdateStatus={handleUpdateStatus}
          onDeleteStatus={handleDeleteStatus}
          onCreateAssignee={handleCreateAssignee}
          onUpdateAssignee={handleUpdateAssignee}
          onDeleteAssignee={handleDeleteAssignee}
          onCreateTag={handleCreateTag}
          onUpdateTag={handleUpdateTag}
          onDeleteTag={handleDeleteTag}
          onDelete={() => trackedDeleteCard(visibleDetailCard.id)}
          onClose={() => setDetailId(null)}
        />
      )}

      <Canvas
        key={boardId}
        boardId={boardId}
        cards={cards}
        connectors={connectors}
        statusOptions={statusOptions}
        assigneeOptions={assigneeOptions}
        tagOptions={tagOptions}
        selectedIds={selectedIds}
        onSelect={setSelectedIds}
        onOpenDetail={setDetailId}
        onCloseDetail={() => setDetailId(null)}
        onCreateCard={trackedCreateCard}
        onUpdateCard={trackedUpdateCard}
        onDeleteCard={trackedDeleteCard}
        onCreateConnector={trackedCreateConnector}
        onUpdateConnector={trackedUpdateConnector}
        onDeleteConnector={trackedDeleteConnector}
        objectClipboard={objectClipboard}
        onObjectClipboardChange={setObjectClipboard}
        tool={tool}
        setTool={setTool}
        focusRequest={focusRequest}
      />

      <Toolbar
        tool={tool}
        setTool={setTool}
        onOpenHierarchy={() => setHierarchyOpen(true)}
      />

      <HierarchyView
        open={hierarchyOpen}
        onClose={() => setHierarchyOpen(false)}
        cards={cards}
        connectors={connectors}
        // If the user has a multi-select, every selected card becomes a
        // tree root; otherwise an empty hierarchy + helpful empty state.
        rootIds={selectedIds}
        onFocusCard={handleFocusCard}
        statusOptions={statusOptions}
        assigneeOptions={assigneeOptions}
        tagOptions={tagOptions}
      />

      <SearchBar
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        cards={cards}
        onFocus={handleFocusCard}
      />

      {loading && <div className="status-pill">Loading…</div>}
      {error && <div className="status-pill error">{error}</div>}
    </div>
  )
}

function mergeMissingOptions(options, values) {
  const existing = new Set(options.map((option) => option.value?.toLowerCase()).filter(Boolean))
  const additions = values.reduce((next, value) => {
    const normalized = normalizeOption(value)
    if (!normalized || existing.has(normalized.toLowerCase())) return next
    existing.add(normalized.toLowerCase())
    const option = createOption(normalized)
    if (option) next.push(option)
    return next
  }, [])

  if (additions.length === 0) return options
  return [...options, ...additions]
}

function createLibraryOption(label, color, options, setOptions) {
  const option = createOption(label, color)
  if (!option) return null
  const exists = options.find(
    (item) => item.value?.toLowerCase() === option.value.toLowerCase(),
  )
  if (exists) return exists

  setOptions((prev) => [...prev, option])
  return option
}

function updateLibraryOption(id, patch, options, setOptions, updateCards) {
  const current = options.find((option) => option.id === id)
  if (!current) return null
  const nextLabel = patch.label != null ? normalizeOption(patch.label) : current.label
  const nextColor = patch.color || current.color
  if (!nextLabel) return null
  const duplicate = options.find(
    (option) => option.id !== id && option.value?.toLowerCase() === nextLabel.toLowerCase(),
  )
  if (duplicate) return null

  const rename = nextLabel !== current.value ? { from: current.value, to: nextLabel } : null
  setOptions((prev) =>
    prev.map((option) =>
      option.id === id
        ? { ...option, label: nextLabel, value: nextLabel, color: nextColor }
        : option,
    ),
  )
  if (rename) updateCards(rename.from, rename.to)
  return rename?.to || current.value
}
