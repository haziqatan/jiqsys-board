import { Extension, mergeAttributes, Node } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import {
  CellSelection,
  TableMap,
  addColumn,
  addRow,
  deleteColumn,
  deleteRow,
  findTable,
  goToNextCell,
  selectedRect,
  tableEditing,
} from '@tiptap/pm/tables'

export const RichTableEditing = Extension.create({
  name: 'richTableEditing',

  addProseMirrorPlugins() {
    const deleteSelectedAxisPlugin = new Plugin({
      props: {
        handleKeyDown: (view, event) => {
          if (event.key !== 'Delete' && event.key !== 'Backspace') return false
          const { state } = view
          const { selection } = state
          if (!(selection instanceof CellSelection)) return false

          if (selection.isRowSelection()) {
            event.preventDefault()
            return deleteRow(state, view.dispatch)
          }
          if (selection.isColSelection()) {
            event.preventDefault()
            return deleteColumn(state, view.dispatch)
          }
          return false
        },
      },
    })

    return [deleteSelectedAxisPlugin, tableEditing()]
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

  addNodeView() {
    return ({ editor, getPos }) => {
      let rafId = null

      const shell = document.createElement('div')
      shell.className = 'rte-table-shell'

      const rowHandles = document.createElement('div')
      rowHandles.className = 'rte-table-row-handles'

      const table = document.createElement('table')
      const tbody = document.createElement('tbody')
      table.appendChild(tbody)

      const addColumnButton = document.createElement('button')
      addColumnButton.type = 'button'
      addColumnButton.className = 'rte-table-add rte-table-add-column'
      addColumnButton.textContent = '+'
      addColumnButton.title = 'Click to add a new column'
      addColumnButton.setAttribute('aria-label', 'Add column')
      addColumnButton.contentEditable = 'false'

      const addRowButton = document.createElement('button')
      addRowButton.type = 'button'
      addRowButton.className = 'rte-table-add rte-table-add-row'
      addRowButton.textContent = '+'
      addRowButton.title = 'Click to add a new row'
      addRowButton.setAttribute('aria-label', 'Add row')
      addRowButton.contentEditable = 'false'

      shell.append(rowHandles, table, addColumnButton, addRowButton)

      const tablePos = () => (typeof getPos === 'function' ? getPos() : null)

      const runTableChange = (buildTransaction) => {
        const pos = tablePos()
        if (pos == null) return
        const { state, view } = editor
        const tableNode = state.doc.nodeAt(pos)
        if (!tableNode || tableNode.type.name !== 'table') return
        const map = TableMap.get(tableNode)
        const tr = buildTransaction(state.tr, {
          map,
          table: tableNode,
          tableStart: pos + 1,
        })
        view.dispatch(tr.scrollIntoView())
        view.focus()
      }

      const addRowAtEnd = (event) => {
        event.preventDefault()
        event.stopPropagation()
        runTableChange((tr, rect) => addRow(tr, rect, rect.map.height))
      }

      const addColumnAtEnd = (event) => {
        event.preventDefault()
        event.stopPropagation()
        runTableChange((tr, rect) => addColumn(tr, rect, rect.map.width))
      }

      addRowButton.addEventListener('mousedown', addRowAtEnd)
      addColumnButton.addEventListener('mousedown', addColumnAtEnd)

      const selectRow = (rowIndex, event) => {
        event.preventDefault()
        event.stopPropagation()
        const pos = tablePos()
        if (pos == null) return
        const { state, view } = editor
        const tableNode = state.doc.nodeAt(pos)
        if (!tableNode || tableNode.type.name !== 'table') return
        const map = TableMap.get(tableNode)
        if (rowIndex < 0 || rowIndex >= map.height) return
        const tableStart = pos + 1
        const firstCell = map.positionAt(rowIndex, 0, tableNode)
        const lastCell = map.positionAt(rowIndex, map.width - 1, tableNode)
        const tr = state.tr.setSelection(
          CellSelection.rowSelection(
            state.doc.resolve(tableStart + firstCell),
            state.doc.resolve(tableStart + lastCell),
          ),
        )
        view.dispatch(tr.scrollIntoView())
        view.focus()
        syncActiveRowHandles()
      }

      const syncActiveRowHandles = () => {
        rowHandles.querySelectorAll('.rte-table-row-handle').forEach((handle) => {
          handle.classList.remove('active')
        })

        const { state } = editor
        const tableInfo = findTable(state.selection.$from)
        const pos = tablePos()
        if (pos == null || !tableInfo || tableInfo.pos !== pos) return
        if (!(state.selection instanceof CellSelection) || !state.selection.isRowSelection()) return

        const rect = selectedRect(state)
        rowHandles.querySelectorAll('.rte-table-row-handle').forEach((handle) => {
          const rowIndex = Number(handle.dataset.row)
          if (rowIndex >= rect.top && rowIndex < rect.bottom) handle.classList.add('active')
        })
      }

      const syncControls = () => {
        rafId = null
        const rows = Array.from(tbody.children).filter((child) => child.tagName === 'TR')
        rowHandles.replaceChildren()
        rows.forEach((row, rowIndex) => {
          const handle = document.createElement('button')
          handle.type = 'button'
          handle.className = 'rte-table-row-handle'
          handle.dataset.row = String(rowIndex)
          handle.title = 'Select row'
          handle.setAttribute('aria-label', `Select row ${rowIndex + 1}`)
          handle.contentEditable = 'false'
          handle.style.top = `${row.offsetTop}px`
          handle.style.height = `${row.offsetHeight}px`
          handle.addEventListener('mousedown', (event) => selectRow(rowIndex, event))
          rowHandles.appendChild(handle)
        })
        syncActiveRowHandles()
      }

      const scheduleSyncControls = () => {
        if (rafId != null) cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(syncControls)
      }

      const resizeObserver = new ResizeObserver(scheduleSyncControls)
      resizeObserver.observe(shell)

      const selectionHandler = () => syncActiveRowHandles()
      editor.on('selectionUpdate', selectionHandler)
      scheduleSyncControls()

      return {
        dom: shell,
        contentDOM: tbody,
        update(updatedNode) {
          if (updatedNode.type.name !== 'table') return false
          scheduleSyncControls()
          return true
        },
        ignoreMutation(mutation) {
          return !tbody.contains(mutation.target)
        },
        destroy() {
          if (rafId != null) cancelAnimationFrame(rafId)
          resizeObserver.disconnect()
          editor.off('selectionUpdate', selectionHandler)
          addRowButton.removeEventListener('mousedown', addRowAtEnd)
          addColumnButton.removeEventListener('mousedown', addColumnAtEnd)
        },
      }
    }
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
