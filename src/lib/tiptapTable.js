import { mergeAttributes, Node } from '@tiptap/core'

export const RichTable = Node.create({
  name: 'table',
  group: 'block',
  content: 'tableRow+',
  isolating: true,
  tableRole: 'table',

  parseHTML() {
    return [{ tag: 'table' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['table', mergeAttributes(HTMLAttributes), ['tbody', 0]]
  },
})

export const RichTableRow = Node.create({
  name: 'tableRow',
  content: '(tableCell | tableHeader)*',
  tableRole: 'row',

  parseHTML() {
    return [{ tag: 'tr' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['tr', mergeAttributes(HTMLAttributes), 0]
  },
})

const cellAttributes = {
  colspan: {
    default: 1,
    parseHTML: (element) => Number(element.getAttribute('colspan')) || 1,
  },
  rowspan: {
    default: 1,
    parseHTML: (element) => Number(element.getAttribute('rowspan')) || 1,
  },
}

export const RichTableCell = Node.create({
  name: 'tableCell',
  content: 'block+',
  tableRole: 'cell',
  isolating: true,

  addAttributes() {
    return cellAttributes
  },

  parseHTML() {
    return [{ tag: 'td' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['td', mergeAttributes(HTMLAttributes), 0]
  },
})

export const RichTableHeader = Node.create({
  name: 'tableHeader',
  content: 'block+',
  tableRole: 'header_cell',
  isolating: true,

  addAttributes() {
    return cellAttributes
  },

  parseHTML() {
    return [{ tag: 'th' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['th', mergeAttributes(HTMLAttributes), 0]
  },
})

export function createTableContent(rows = 3, columns = 3) {
  return {
    type: 'table',
    content: Array.from({ length: rows }, (_, rowIndex) => ({
      type: 'tableRow',
      content: Array.from({ length: columns }, () => ({
        type: rowIndex === 0 ? 'tableHeader' : 'tableCell',
        content: [{ type: 'paragraph' }],
      })),
    })),
  }
}
