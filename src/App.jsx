import { useEffect, useRef, useState, useCallback } from 'react'
import Canvas from './components/Canvas'
import Toolbar from './components/Toolbar'
import CardDetail from './components/CardDetail'
import BoardMenu from './components/BoardMenu'
import SearchBar from './components/SearchBar'
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
import { DEFAULT_STATUS_OPTIONS, createStatusOption, normalizeStatus } from './lib/status'
import { createOption, loadOptions, normalizeOption, saveOptions } from './lib/options'
import './App.css'

const isDetailCard = (card) => (card?.node_shape || 'rect') === 'rect'
const ACTIVE_BOARD_KEY = 'jiqsys-active-board'
const STATUS_OPTIONS_KEY = 'jiqsys-status-options'
const ASSIGNEE_OPTIONS_KEY = 'jiqsys-assignee-options'
const TAG_OPTIONS_KEY = 'jiqsys-tag-options'

function loadStatusOptions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STATUS_OPTIONS_KEY) || 'null')
    if (Array.isArray(saved) && saved.length > 0) {
      return [
        DEFAULT_STATUS_OPTIONS[0],
        ...saved.reduce((options, item) => {
          const option = createStatusOption(item.label || item.value, item.color)
          if (option) options.push({ ...option, id: item.id || option.id })
          return options
        }, []),
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
  const [selectedId, setSelectedId] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [tool, setTool] = useState('select')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusOptions, setStatusOptions] = useState(loadStatusOptions)
  const [assigneeOptions, setAssigneeOptions] = useState(() => loadOptions(ASSIGNEE_OPTIONS_KEY))
  const [tagOptions, setTagOptions] = useState(() => loadOptions(TAG_OPTIONS_KEY))
  const [searchOpen, setSearchOpen] = useState(false)
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

  // Cmd/Ctrl+F → toggle search bar (intercepts browser's find)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleFocusCard = useCallback((id) => {
    setFocusRequest((prev) => ({ id, token: prev.token + 1 }))
    setSelectedId(id)
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
    setSelectedId(null)
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
      setSelectedId(card.id)
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
      if (selectedId === id) setSelectedId(null)
      try {
        await deleteCard(id)
      } catch (e) {
        console.error(e)
      }
    },
    [detailId, selectedId],
  )

  const handleCreateConnector = useCallback(
    async (sourceId, targetId, opts = {}) => {
      if (!sourceId || !targetId || sourceId === targetId) return
      const exists = connectors.find(
        (c) => c.source_card_id === sourceId && c.target_card_id === targetId,
      )
      if (exists) return
      const conn = await createConnector(boardId, sourceId, targetId, opts)
      setConnectors((prev) => [...prev.filter((c) => c.id !== conn.id), conn])
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
          onUpdate={(patch) => handleUpdateCard(visibleDetailCard.id, patch)}
          onCreateStatus={handleCreateStatus}
          onUpdateStatus={handleUpdateStatus}
          onDeleteStatus={handleDeleteStatus}
          onCreateAssignee={handleCreateAssignee}
          onUpdateAssignee={handleUpdateAssignee}
          onDeleteAssignee={handleDeleteAssignee}
          onCreateTag={handleCreateTag}
          onUpdateTag={handleUpdateTag}
          onDeleteTag={handleDeleteTag}
          onDelete={() => handleDeleteCard(visibleDetailCard.id)}
          onClose={() => setDetailId(null)}
        />
      )}

      <Canvas
        key={boardId}
        cards={cards}
        connectors={connectors}
        statusOptions={statusOptions}
        assigneeOptions={assigneeOptions}
        tagOptions={tagOptions}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onOpenDetail={setDetailId}
        onCreateCard={handleCreateCard}
        onUpdateCard={handleUpdateCard}
        onDeleteCard={handleDeleteCard}
        onCreateConnector={handleCreateConnector}
        onUpdateConnector={handleUpdateConnector}
        onDeleteConnector={handleDeleteConnector}
        tool={tool}
        setTool={setTool}
        focusRequest={focusRequest}
      />

      <Toolbar tool={tool} setTool={setTool} />

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
