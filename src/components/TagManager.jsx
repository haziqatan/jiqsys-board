import { useState } from 'react'
import '../styles/TagManager.css'

export default function TagManager({ tags, onChange }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const v = draft.trim()
    if (!v) return
    if (tags.includes(v)) {
      setDraft('')
      return
    }
    onChange([...tags, v])
    setDraft('')
  }

  const remove = (t) => onChange(tags.filter((x) => x !== t))

  return (
    <div className="tag-manager">
      <div className="tags-list">
        {tags.map((t) => (
          <span key={t} className="tag-badge">
            #{t}
            <button onClick={() => remove(t)}>×</button>
          </span>
        ))}
      </div>
      <div className="tag-input-row">
        <input
          className="tag-input"
          placeholder="Add tag…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button className="tag-add" onClick={add}>Add</button>
      </div>
    </div>
  )
}
