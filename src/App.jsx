import { useEffect, useState, useCallback } from 'react'
import Canvas from './components/Canvas'
import Toolbar from './components/Toolbar'
import CardDetail from './components/CardDetail'
import BoardMenu from './components/BoardMenu'
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
import './App.css'

const isDetailCard = (card) => (card?.node_shape || 'rect') === 'rect'
const ACTIVE_BOARD_KEY = 'jiqsys-active-board'

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

  // Persist active board
  useEffect(() => {
    if (boardId) localStorage.setItem(ACTIVE_BOARD_KEY, boardId)
  }, [boardId])

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

  const handleUpdateCard = useCallback(async (id, patch) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
    try {
      await updateCard(id, patch)
    } catch (e) {
      console.error(e)
    }
  }, [])

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
          onUpdate={(patch) => handleUpdateCard(visibleDetailCard.id, patch)}
          onDelete={() => handleDeleteCard(visibleDetailCard.id)}
          onClose={() => setDetailId(null)}
        />
      )}

      <Canvas
        key={boardId}
        cards={cards}
        connectors={connectors}
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
      />

      <Toolbar tool={tool} setTool={setTool} />

      {loading && <div className="status-pill">Loading…</div>}
      {error && <div className="status-pill error">{error}</div>}
    </div>
  )
}
