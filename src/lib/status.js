export const DEFAULT_STATUS_OPTIONS = [
  { value: null, label: 'Not set', color: '#cbd0db' },
  { value: 'To Do', label: 'To Do', color: '#94a3b8', id: 'to-do' },
  { value: 'In Progress', label: 'In Progress', color: '#3b82f6', id: 'in-progress' },
  { value: 'Blocked', label: 'Blocked', color: '#ef4444', id: 'blocked' },
  { value: 'Done', label: 'Done', color: '#22c55e', id: 'done' },
]

const CUSTOM_STATUS_COLORS = [
  '#0ea5e9',
  '#8b5cf6',
  '#f97316',
  '#14b8a6',
  '#ec4899',
  '#64748b',
]

const DEFAULT_STATUS_COLOR_MAP = DEFAULT_STATUS_OPTIONS.reduce((map, option) => {
  if (option.value) map[option.value] = option.color
  return map
}, {})

export function createStatusOption(label, color = '#0ea5e9') {
  const normalized = normalizeStatus(label)
  if (!normalized) return null

  return {
    id: `${normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
    value: normalized,
    label: normalized,
    color,
  }
}

export function normalizeStatus(value) {
  const trimmed = String(value || '').trim()
  return trimmed || null
}

export function getStatusColor(status, options = DEFAULT_STATUS_OPTIONS) {
  if (!status) return DEFAULT_STATUS_OPTIONS[0].color
  const option = options.find((item) => item.value === status)
  if (option) return option.color
  if (DEFAULT_STATUS_COLOR_MAP[status]) return DEFAULT_STATUS_COLOR_MAP[status]

  const hash = Array.from(status).reduce((total, char) => total + char.charCodeAt(0), 0)
  return CUSTOM_STATUS_COLORS[hash % CUSTOM_STATUS_COLORS.length]
}

export function getStatusOptions(status, options = DEFAULT_STATUS_OPTIONS) {
  const normalized = normalizeStatus(status)
  const hasOption = options.some((option) => option.value === normalized)

  if (!normalized || hasOption) return options

  return [
    ...options,
    {
      value: normalized,
      label: normalized,
      color: getStatusColor(normalized, options),
      custom: true,
    },
  ]
}
