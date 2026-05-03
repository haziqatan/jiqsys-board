export const DEFAULT_STATUS_OPTIONS = [
  { value: null, label: 'Not set', color: '#cbd0db' },
  { value: 'To Do', label: 'To Do', color: '#94a3b8' },
  { value: 'In Progress', label: 'In Progress', color: '#3b82f6' },
  { value: 'Blocked', label: 'Blocked', color: '#ef4444' },
  { value: 'Done', label: 'Done', color: '#22c55e' },
]

const CUSTOM_STATUS_COLORS = [
  '#0ea5e9',
  '#8b5cf6',
  '#f97316',
  '#14b8a6',
  '#ec4899',
  '#64748b',
]

const STATUS_COLOR_MAP = DEFAULT_STATUS_OPTIONS.reduce((map, option) => {
  if (option.value) map[option.value] = option.color
  return map
}, {})

export function normalizeStatus(value) {
  const trimmed = String(value || '').trim()
  return trimmed || null
}

export function getStatusColor(status) {
  if (!status) return DEFAULT_STATUS_OPTIONS[0].color
  if (STATUS_COLOR_MAP[status]) return STATUS_COLOR_MAP[status]

  const hash = Array.from(status).reduce((total, char) => total + char.charCodeAt(0), 0)
  return CUSTOM_STATUS_COLORS[hash % CUSTOM_STATUS_COLORS.length]
}

export function getStatusOptions(status) {
  const normalized = normalizeStatus(status)
  const hasDefault = DEFAULT_STATUS_OPTIONS.some((option) => option.value === normalized)

  if (!normalized || hasDefault) return DEFAULT_STATUS_OPTIONS

  return [
    ...DEFAULT_STATUS_OPTIONS,
    {
      value: normalized,
      label: normalized,
      color: getStatusColor(normalized),
      custom: true,
    },
  ]
}
