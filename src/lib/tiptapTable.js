import { Extension, mergeAttributes, Node } from '@tiptap/core'
import {
  addColumnAfter,
  addRowAfter,
  deleteColumn,
  deleteRow,
  goToNextCell,
  tableEditing,
} from '@tiptap/pm/tables'

export const RichTableEditing = Extension.create({
  name: 'richTableEditing',

  addProseMirrorPlugins() {
    return [tableEditing()]
  },

  addCommands() {
    return {
      addRichTableColumnAfter:
        () =>
        ({ state, dispatch }) =>
          addColumnAfter(state, dispatch),
      deleteRichTableColumn:
        () =>
        ({ state, dispatch }) =>
          deleteColumn(state, dispatch),
      addRichTableRowAfter:
        () =>
        ({ state, dispatch }) =>
          addRowAfter(state, dispatch),
      deleteRichTableRow:
        () =>
        ({ state, dispatch }) =>
          deleteRow(state, dispatch),
    }
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => goToNextCell(1)(this.editor.state, this.editor.view.dispatch),
      'Shift-Tab': () => goToNextCell(-1)(this.editor.state, this.editor.view.dispatch),
    }
  },
})

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
    renderHTML: ({ colspan }) => (colspan > 1 ? { colspan } : {}),
  },
  rowspan: {
    default: 1,
    parseHTML: (element) => Number(element.getAttribute('rowspan')) || 1,
    renderHTML: ({ rowspan }) => (rowspan > 1 ? { rowspan } : {}),
  },
  colwidth: {
    default: null,
    parseHTML: (element) => {
      const value = element.getAttribute('data-colwidth')
      if (!value || !/^\d+(,\d+)*$/.test(value)) return null
      const widths = value.split(',').map((item) => Number(item))
      const colspan = Number(element.getAttribute('colspan')) || 1
      return widths.length === colspan ? widths : null
    },
    renderHTML: ({ colwidth }) => (
      Array.isArray(colwidth) ? { 'data-colwidth': colwidth.join(',') } : {}
    ),
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
    content: Array.from({ length: rows }, () => ({
      type: 'tableRow',
      content: Array.from({ length: columns }, () => ({
        type: 'tableCell',
        content: [{ type: 'paragraph' }],
      })),
    })),
  }
}
