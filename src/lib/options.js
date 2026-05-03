const FALLBACK_COLORS = [
  '#0ea5e9',
  '#8b5cf6',
  '#f97316',
  '#14b8a6',
  '#ec4899',
  '#64748b',
]

export function normalizeOption(value) {
  const trimmed = String(value || '').trim()
  return trimmed || null
}

export function createOption(label, color = '#0ea5e9') {
  const normalized = normalizeOption(label)
  if (!normalized) return null

  return {
    id: `${normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
    value: normalized,
    label: normalized,
    color,
  }
}

export function getOptionColor(value, options = []) {
  if (!value) return '#cbd0db'
  const option = options.find((item) => item.value === value)
  if (option) return option.color

  const hash = Array.from(value).reduce((total, char) => total + char.charCodeAt(0), 0)
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length]
}

export function loadOptions(key, defaults = []) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null')
    if (!Array.isArray(saved)) return defaults
    return saved.reduce((options, item) => {
      const option = createOption(item.label || item.value, item.color)
      if (option) options.push({ ...option, id: item.id || option.id })
      return options
    }, [])
  } catch {
    localStorage.removeItem(key)
    return defaults
  }
}

export function saveOptions(key, options) {
  localStorage.setItem(key, JSON.stringify(options))
}
