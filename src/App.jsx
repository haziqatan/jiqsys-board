import { useEffect, useState, useCallback } from 'react'
import Canvas from './components/Canvas'
import Toolbar from './components/Toolbar'
import CardDetail from './components/CardDetail'
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
} from './lib/db'
import { DEFAULT_BOARD_ID, supabase } from './lib/supabase'
import './App.css'

const isDetailCard = (card) => (card?.node_shape || 'rect') === 'rect'

export default function App() {
  const [boardId] = useState(DEFAULT_BOARD_ID)
  const [cards, setCards] = useState([])
  const [connectors, setConnectors] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [tool, setTool] = useState('select')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  useEffect(() => {
    let cancelled = false
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
        setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [boardId])

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
