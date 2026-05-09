const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

// Duotone fill: a soft body using currentColor at 18% opacity.
const duo = { fill: 'currentColor', fillOpacity: 0.18, stroke: 'none' }

export const IconCursor = (p) => (
  <svg {...base} {...p}>
    <path d="M5 3l6 16 2-7 7-2z" {...duo} />
    <path d="M5 3l6 16 2-7 7-2z" />
  </svg>
)

export const IconCard = (p) => (
  <svg {...base} {...p}>
    <rect x="4" y="6" width="16" height="12" rx="2.5" {...duo} />
    <rect x="4" y="6" width="16" height="12" rx="2.5" />
    <path d="M4 10h16" />
  </svg>
)

export const IconArrow = (p) => (
  <svg {...base} {...p}>
    <path d="M4 12h14" />
    <path d="M14 7l5 5-5 5" />
  </svg>
)

export const IconArrowBoth = (p) => (
  <svg {...base} {...p}>
    <path d="M4 12h16" />
    <path d="M9 7l-5 5 5 5" />
    <path d="M15 7l5 5-5 5" />
  </svg>
)

export const IconArrowLeft = (p) => (
  <svg {...base} {...p}>
    <path d="M20 12H6" />
    <path d="M10 7l-5 5 5 5" />
  </svg>
)

export const IconArrowNone = (p) => (
  <svg {...base} {...p}>
    <path d="M4 12h16" />
  </svg>
)

export const IconStraight = (p) => (
  <svg {...base} {...p}>
    <path d="M4 19L20 5" />
  </svg>
)

export const IconOrthogonal = (p) => (
  <svg {...base} {...p}>
    <path d="M4 18h6v-6h10" />
  </svg>
)

export const IconCurved = (p) => (
  <svg {...base} {...p}>
    <path d="M4 18 C 6 8, 16 16, 20 6" />
  </svg>
)

export const IconJump = (p) => (
  <svg {...base} {...p}>
    <path d="M3 16h5 a3 3 0 0 1 6 0 h7" />
  </svg>
)

export const IconTrash = (p) => (
  <svg {...base} {...p}>
    <path d="M6 7l1 13h10l1-13" {...duo} />
    <path d="M4 7h16" />
    <path d="M9 7V4h6v3" />
    <path d="M6 7l1 13h10l1-13" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
)

export const IconClose = (p) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </svg>
)

export const IconPlus = (p) => (
  <svg {...base} {...p}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
)

export const IconMinus = (p) => (
  <svg {...base} {...p}>
    <path d="M5 12h14" />
  </svg>
)

export const IconHome = (p) => (
  <svg {...base} {...p}>
    <path d="M6 10v9h12v-9l-6-6z" {...duo} />
    <path d="M4 11l8-7 8 7" />
    <path d="M6 10v9h12v-9" />
  </svg>
)

export const IconCalendar = (p) => (
  <svg {...base} {...p}>
    <rect x="4" y="5" width="16" height="15" rx="2" {...duo} />
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16" />
    <path d="M9 3v4" />
    <path d="M15 3v4" />
  </svg>
)

export const IconDots = (p) => (
  <svg {...base} {...p}>
    <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
)

export const IconSettings = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" {...duo} />
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.8 1.8 0 0 0 .35 2l.05.05-2.1 2.1-.05-.05a1.8 1.8 0 0 0-2-.35 1.8 1.8 0 0 0-1.1 1.65V20.5h-3v-.1A1.8 1.8 0 0 0 10.4 18.8a1.8 1.8 0 0 0-2 .35l-.05.05-2.1-2.1.05-.05a1.8 1.8 0 0 0 .35-2A1.8 1.8 0 0 0 5 13.95H4.9v-3H5A1.8 1.8 0 0 0 6.6 9.85a1.8 1.8 0 0 0-.35-2L6.2 7.8l2.1-2.1.05.05a1.8 1.8 0 0 0 2 .35A1.8 1.8 0 0 0 11.45 4.5v-.1h3v.1a1.8 1.8 0 0 0 1.1 1.6 1.8 1.8 0 0 0 2-.35l.05-.05 2.1 2.1-.05.05a1.8 1.8 0 0 0-.35 2 1.8 1.8 0 0 0 1.65 1.1h.1v3h-.1A1.8 1.8 0 0 0 19.4 15z" />
  </svg>
)

export const IconLock = (p) => (
  <svg {...base} {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2.2" {...duo} />
    <rect x="5" y="11" width="14" height="9" rx="2.2" />
    <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
  </svg>
)

export const IconGridDots = (p) => (
  <svg {...base} {...p}>
    <circle cx="6" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="12" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="18" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="6" cy="18" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="12" cy="18" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="18" cy="18" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)

export const IconBold = (p) => (
  <svg {...base} {...p}>
    <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z" />
    <path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z" />
  </svg>
)

export const IconItalic = (p) => (
  <svg {...base} {...p}>
    <path d="M14 5h-4" />
    <path d="M15 19h-4" />
    <path d="M15 5l-4 14" />
  </svg>
)

export const IconUnderline = (p) => (
  <svg {...base} {...p}>
    <path d="M7 5v7a5 5 0 0 0 10 0V5" />
    <path d="M5 20h14" />
  </svg>
)

export const IconStrike = (p) => (
  <svg {...base} {...p}>
    <path d="M5 12h14" />
    <path d="M16 6a4 4 0 0 0-4-2c-3 0-5 2-5 4 0 1 .5 2 2 3" />
    <path d="M8 18a4 4 0 0 0 4 2c3 0 5-2 5-4 0-1-.5-2-2-3" />
  </svg>
)

export const IconList = (p) => (
  <svg {...base} {...p}>
    <path d="M9 6h11" />
    <path d="M9 12h11" />
    <path d="M9 18h11" />
    <circle cx="5" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="5" cy="18" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)

export const IconListNumbered = (p) => (
  <svg {...base} {...p}>
    <path d="M10 6h10" />
    <path d="M10 12h10" />
    <path d="M10 18h10" />
    <path d="M4 6h2v0M4 12h3M4 18h3" />
  </svg>
)

export const IconCheck = (p) => (
  <svg {...base} {...p}>
    <path d="M5 12l4 4 10-10" />
  </svg>
)

export const IconImage = (p) => (
  <svg {...base} {...p}>
    <rect x="4" y="5" width="16" height="14" rx="2" {...duo} />
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="M5 17l5-5 4 4 2-2 4 4" />
  </svg>
)

export const IconLink = (p) => (
  <svg {...base} {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
)

export const IconShapes = (p) => (
  <svg {...base} {...p}>
    <circle cx="7.5" cy="8" r="4" {...duo} />
    <rect x="13" y="4" width="8" height="8" rx="1.5" {...duo} />
    <path d="M11.5 21l4.5-7 4.5 7z" {...duo} />
    <circle cx="7.5" cy="8" r="4" />
    <rect x="13" y="4" width="8" height="8" rx="1.5" />
    <path d="M11.5 21l4.5-7 4.5 7z" />
  </svg>
)

export const IconMenu = (p) => (
  <svg {...base} {...p}>
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </svg>
)

export const IconEdit = (p) => (
  <svg {...base} {...p}>
    <path d="M4 20h4l11-11-4-4L4 16z" />
    <path d="M14 6l4 4" />
  </svg>
)

export const IconTriangle = (p) => (
  <svg {...base} {...p}>
    <path d="M12 4l9 16H3z" {...duo} />
    <path d="M12 4l9 16H3z" />
  </svg>
)

export const IconStar = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3l2.6 5.4 5.9.7-4.4 4.1 1.1 5.8L12 16.3 6.8 19l1.1-5.8-4.4-4.1 5.9-.7z" {...duo} />
    <path d="M12 3l2.6 5.4 5.9.7-4.4 4.1 1.1 5.8L12 16.3 6.8 19l1.1-5.8-4.4-4.1 5.9-.7z" />
  </svg>
)

export const IconArrowShape = (p) => (
  <svg {...base} {...p}>
    <path d="M3 9h11V5l7 7-7 7v-4H3z" {...duo} />
    <path d="M3 9h11V5l7 7-7 7v-4H3z" strokeLinejoin="round" />
  </svg>
)

export const IconRectangle = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="7" width="18" height="10" rx="1.5" {...duo} />
    <rect x="3" y="7" width="18" height="10" rx="1.5" />
  </svg>
)

export const IconSquare = (p) => (
  <svg {...base} {...p}>
    <rect x="5" y="5" width="14" height="14" rx="1.5" {...duo} />
    <rect x="5" y="5" width="14" height="14" rx="1.5" />
  </svg>
)

export const IconText = (p) => (
  <svg {...base} {...p}>
    <path d="M5 7V5h14v2" />
    <path d="M12 5v14" />
    <path d="M9 19h6" />
  </svg>
)

export const IconRounded = (p) => (
  <svg {...base} {...p}>
    <path d="M4 18h4a6 6 0 0 0 6-6V8a4 4 0 0 1 4-4h2" strokeLinejoin="round" />
  </svg>
)

export const IconPanelLeft = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18" />
  </svg>
)

export const IconModal = (p) => (
  <svg {...base} {...p}>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <path d="M4 9h16" />
  </svg>
)

export const IconExpandFull = (p) => (
  <svg {...base} {...p}>
    <path d="M3 8V3h5" />
    <path d="M3 3l5 5" />
    <path d="M21 8V3h-5" />
    <path d="M21 3l-5 5" />
    <path d="M3 16v5h5" />
    <path d="M3 21l5-5" />
    <path d="M21 16v5h-5" />
    <path d="M21 21l-5-5" />
  </svg>
)

export const IconCollapse = (p) => (
  <svg {...base} {...p}>
    <path d="M9 4v5H4" />
    <path d="M4 9l5-5" />
    <path d="M15 4v5h5" />
    <path d="M20 9l-5-5" />
    <path d="M9 20v-5H4" />
    <path d="M4 15l5 5" />
    <path d="M15 20v-5h5" />
    <path d="M20 15l-5 5" />
  </svg>
)

export const IconCircle = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8" {...duo} />
    <circle cx="12" cy="12" r="8" />
  </svg>
)

export const IconDiamond = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3l9 9-9 9-9-9z" {...duo} />
    <path d="M12 3l9 9-9 9-9-9z" />
  </svg>
)

export const IconHexagon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" {...duo} />
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
  </svg>
)

export const IconParallelogram = (p) => (
  <svg {...base} {...p}>
    <path d="M6 18h10l4-12H10z" {...duo} />
    <path d="M6 18h10l4-12H10z" />
  </svg>
)

export const IconSearch = (p) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="6.5" {...duo} />
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </svg>
)

export const IconChevronLeft = (p) => (
  <svg {...base} {...p}>
    <path d="M14 6l-6 6 6 6" />
  </svg>
)

export const IconChevronRight = (p) => (
  <svg {...base} {...p}>
    <path d="M10 6l6 6-6 6" />
  </svg>
)

export const IconAlignLeft = (p) => (
  <svg {...base} {...p}>
    <path d="M3 6h18M3 12h12M3 18h15" />
  </svg>
)

export const IconAlignCenter = (p) => (
  <svg {...base} {...p}>
    <path d="M3 6h18M6 12h12M4.5 18h15" />
  </svg>
)

export const IconAlignRight = (p) => (
  <svg {...base} {...p}>
    <path d="M3 6h18M9 12h12M6 18h15" />
  </svg>
)

export const IconTextColor = (p) => (
  <svg {...base} {...p}>
    <path d="M4 20h4m4 0h4M9 4l-5 16M9 4l5 16M6.5 13h7" strokeLinecap="round" />
  </svg>
)

export const IconTable = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" {...duo} />
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 10h18M3 15h18M9 5v14M15 5v14" />
  </svg>
)

export const IconTableRowPlus = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="14" height="12" rx="2" {...duo} />
    <rect x="3" y="5" width="14" height="12" rx="2" />
    <path d="M3 9h14M3 13h14M8 5v12M12 5v12" />
    <path d="M17 19h4M19 17v4" />
  </svg>
)

export const IconTableRowMinus = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="14" height="12" rx="2" {...duo} />
    <rect x="3" y="5" width="14" height="12" rx="2" />
    <path d="M3 9h14M3 13h14M8 5v12M12 5v12" />
    <path d="M17 19h4" />
  </svg>
)

export const IconTableColumnPlus = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="14" height="12" rx="2" {...duo} />
    <rect x="3" y="5" width="14" height="12" rx="2" />
    <path d="M3 9h14M3 13h14M8 5v12M12 5v12" />
    <path d="M20 5v4M18 7h4" />
  </svg>
)

export const IconTableColumnMinus = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="14" height="12" rx="2" {...duo} />
    <rect x="3" y="5" width="14" height="12" rx="2" />
    <path d="M3 9h14M3 13h14M8 5v12M12 5v12" />
    <path d="M18 7h4" />
  </svg>
)

export const IconHierarchy = (p) => (
  <svg {...base} {...p}>
    {/* root */}
    <rect x="9.5" y="3"  width="5" height="4" rx="1.2" {...duo} />
    <rect x="9.5" y="3"  width="5" height="4" rx="1.2" />
    {/* children */}
    <rect x="3"   y="17" width="5" height="4" rx="1.2" />
    <rect x="9.5" y="17" width="5" height="4" rx="1.2" />
    <rect x="16"  y="17" width="5" height="4" rx="1.2" />
    {/* connectors */}
    <path d="M12 7v4M5.5 17V12.5h13V17" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
