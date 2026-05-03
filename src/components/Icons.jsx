const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const IconCursor = (p) => (
  <svg {...base} {...p}>
    <path d="M5 3l6 16 2-7 7-2z" />
  </svg>
)

export const IconCard = (p) => (
  <svg {...base} {...p}>
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
    <path d="M4 11l8-7 8 7" />
    <path d="M6 10v9h12v-9" />
  </svg>
)

export const IconCalendar = (p) => (
  <svg {...base} {...p}>
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
    <circle cx="7.5" cy="7.5" r="4" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <path d="M4 14l4 6H0z" />
    <path d="M13.5 14l3.5 6H10z" />
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

export const IconCircle = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8" />
  </svg>
)

export const IconDiamond = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3l9 9-9 9-9-9z" />
  </svg>
)

export const IconHexagon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
  </svg>
)

export const IconParallelogram = (p) => (
  <svg {...base} {...p}>
    <path d="M6 18h10l4-12H10z" />
  </svg>
)
