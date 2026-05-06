import { useEffect, useMemo, useRef, useState } from 'react'
import { IconSearch, IconClose, IconChevronLeft, IconChevronRight } from './Icons'
import '../styles/SearchBar.css'

const SHAPE_LABEL = {
  rect:          'Card',
  text:          'Text',
  image:         'Image',
  rectangle:     'Rectangle',
  square:        'Square',
  circle:        'Circle',
  diamond:       'Diamond',
  hexagon:       'Hexagon',
  parallelogram: 'Parallelogram',
  triangle:      'Triangle',
  star:          'Star',
  arrow:         'Arrow',
}

// Strip HTML tags to plain text for body search
function htmlToText(html) {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Find which field matched + return a short snippet around the match
function getMatchSnippet(card, query) {
  const q = query.toLowerCase()

  if (card.title && card.title.toLowerCase().includes(q)) {
    return { field: 'title', snippet: card.title }
  }
  if (card.description?.html) {
    const text = htmlToText(card.description.html)
    const idx = text.toLowerCase().indexOf(q)
    if (idx !== -1) {
      const start = Math.max(0, idx - 18)
      const end = Math.min(text.length, idx + query.length + 18)
      const prefix = start > 0 ? '…' : ''
      const suffix = end < text.length ? '…' : ''
      return { field: 'body', snippet: `${prefix}${text.slice(start, end)}${suffix}` }
    }
  }
  if (card.tags?.length) {
    const hit = card.tags.find((tag) => tag.toLowerCase().includes(q))
    if (hit) return { field: 'tag', snippet: `#${hit}` }
  }
  if (card.assignee && card.assignee.toLowerCase().includes(q)) {
    return { field: 'assignee', snippet: `@${card.assignee}` }
  }
  if (card.status && card.status.toLowerCase().includes(q)) {
    return { field: 'status', snippet: card.status }
  }
  return null
}

function highlight(text, query) {
  if (!query) return text
  const q = query.toLowerCase()
  const lower = text.toLowerCase()
  const out = []
  let i = 0
  while (i < text.length) {
    const idx = lower.indexOf(q, i)
    if (idx === -1) { out.push(text.slice(i)); break }
    if (idx > i) out.push(text.slice(i, idx))
    out.push(<mark key={idx}>{text.slice(idx, idx + query.length)}</mark>)
    i = idx + query.length
  }
  return out
}

export default function SearchBar({ open, onClose, cards, onFocus }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Auto-focus input when opening
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [open])

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setActiveIndex(0)
    }
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const matches = []
    for (const card of cards) {
      const m = getMatchSnippet(card, q)
      if (m) matches.push({ card, ...m })
    }
    return matches
  }, [cards, query])

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Auto-focus the active result on the canvas as user navigates
  useEffect(() => {
    if (!open || results.length === 0) return
    const r = results[Math.min(activeIndex, results.length - 1)]
    if (r) onFocus(r.card.id)
  }, [activeIndex, results, open, onFocus])

  // Keep active item scrolled into view in the dropdown
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(`[data-idx="${activeIndex}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!open) return null

  const total = results.length
  const goNext = () => {
    if (total === 0) return
    setActiveIndex((i) => (i + 1) % total)
  }
  const goPrev = () => {
    if (total === 0) return
    setActiveIndex((i) => (i - 1 + total) % total)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) goPrev()
      else goNext()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      goNext()
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      goPrev()
      return
    }
  }

  return (
    <div className="search-bar" role="search">
      <div className="search-bar-input-row">
        <IconSearch width={16} height={16} />
        <input
          ref={inputRef}
          className="search-bar-input"
          type="text"
          placeholder="Search cards, shapes, tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {total > 0 && (
          <span className="search-bar-counter">
            {activeIndex + 1} of {total}
          </span>
        )}
        <button
          className="search-bar-iconbtn"
          title="Previous (Shift+Enter)"
          onClick={goPrev}
          disabled={total === 0}
        >
          <IconChevronLeft width={16} height={16} />
        </button>
        <button
          className="search-bar-iconbtn"
          title="Next (Enter)"
          onClick={goNext}
          disabled={total === 0}
        >
          <IconChevronRight width={16} height={16} />
        </button>
        <button
          className="search-bar-iconbtn"
          title="Close (Esc)"
          onClick={onClose}
        >
          <IconClose width={16} height={16} />
        </button>
      </div>

      {query.trim() && (
        <div className="search-bar-results" ref={listRef}>
          {total === 0 ? (
            <div className="search-bar-empty">No matches</div>
          ) : (
            results.map((r, i) => (
              <button
                key={r.card.id}
                data-idx={i}
                className={`search-bar-result${i === activeIndex ? ' active' : ''}`}
                onClick={() => setActiveIndex(i)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span className="search-bar-result-type">
                  {SHAPE_LABEL[r.card.node_shape || 'rect']}
                </span>
                <span className="search-bar-result-title">
                  {highlight(r.card.title || '(untitled)', query)}
                </span>
                {r.field !== 'title' && (
                  <span className={`search-bar-result-snippet field-${r.field}`}>
                    {highlight(r.snippet, query)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
