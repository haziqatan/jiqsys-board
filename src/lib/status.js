import { createOption, getOptionColor, normalizeOption } from './options'

export const BUGS_STATUS_VALUE = 'Bugs'
export const BUGS_STATUS_COLOR = '#ef4444'

export const DEFAULT_STATUS_OPTIONS = [
  { value: null, label: 'Not set', color: '#cbd0db' },
  { value: 'To Do', label: 'To Do', color: '#94a3b8', id: 'to-do' },
  { value: 'In Progress', label: 'In Progress', color: '#3b82f6', id: 'in-progress' },
  { value: BUGS_STATUS_VALUE, label: BUGS_STATUS_VALUE, color: BUGS_STATUS_COLOR, id: 'bugs' },
  { value: 'Blocked', label: 'Blocked', color: '#ef4444', id: 'blocked' },
  { value: 'Done', label: 'Done', color: '#22c55e', id: 'done' },
]

const DEFAULT_STATUS_COLOR_MAP = DEFAULT_STATUS_OPTIONS.reduce((map, option) => {
  if (option.value) map[option.value] = option.color
  return map
}, {})

export function createStatusOption(label, color = '#0ea5e9') {
  return createOption(label, color)
}

export function normalizeStatus(value) {
  return normalizeOption(value)
}

export function isBugsStatus(status) {
  return normalizeStatus(status)?.toLowerCase() === BUGS_STATUS_VALUE.toLowerCase()
}

export function getStatusColor(status, options = DEFAULT_STATUS_OPTIONS) {
  if (!status) return DEFAULT_STATUS_OPTIONS[0].color
  const option = options.find((item) => item.value === status)
  if (option) return option.color
  return DEFAULT_STATUS_COLOR_MAP[status] || getOptionColor(status, options)
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
