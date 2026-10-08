import type { KeyboardEvent, ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
}

interface TableProps<T> {
  caption: string
  columns: readonly Column<T>[]
  rows: readonly T[]
  getRowKey: (row: T) => string
  onRowClick?: (row: T) => void
  isRowSelected?: (row: T) => boolean
}

export function Table<T>({
  caption,
  columns,
  rows,
  getRowKey,
  onRowClick,
  isRowSelected,
}: TableProps<T>) {
  const handleKeyDown = (event: KeyboardEvent, row: T) => {
    if (event.key === 'Enter') onRowClick?.(row)
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="px-3 py-2 font-semibold text-slate-700"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const selected = isRowSelected?.(row) ?? false
            return (
              <tr
                key={getRowKey(row)}
                {...(onRowClick && {
                  tabIndex: 0,
                  onClick: () => onRowClick(row),
                  onKeyDown: (event: KeyboardEvent) =>
                    handleKeyDown(event, row),
                  'aria-selected': selected,
                })}
                className={`${onRowClick ? 'cursor-pointer hover:bg-slate-50 focus:bg-sky-50 focus:outline-2 focus:outline-sky-600' : ''} ${selected ? 'bg-sky-50' : ''}`}
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-2 align-top">
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
