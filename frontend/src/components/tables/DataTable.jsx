import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import EmptyState from '../ui/EmptyState'

/**
 * Tabela de dados genérica e reutilizável.
 * Props:
 *   columns: [{ key, label, render?, align? }]
 *   data:    array de objetos
 *   sortable: boolean
 */
export default function DataTable({ columns = [], data = [], sortable = true, emptyMessage = 'Nenhum registro encontrado.' }) {
  const [sortKey, setSortKey]   = useState(null)
  const [sortAsc, setSortAsc]   = useState(true)

  const handleSort = (key) => {
    if (!sortable) return
    if (sortKey === key) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(true) }
  }

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const va = a[sortKey]; const vb = b[sortKey]
        if (va == null) return 1
        if (vb == null) return -1
        const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR')
        return sortAsc ? cmp : -cmp
      })
    : data

  if (!sorted.length) return <EmptyState title="Sem registros" description={emptyMessage} />

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={`py-2 pr-4 text-left text-gray-500 font-medium uppercase tracking-wider select-none
                  ${sortable ? 'cursor-pointer hover:text-gray-300' : ''}
                  ${col.align === 'right' ? 'text-right' : ''}
                `}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortable && sortKey === col.key && (
                    sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={row.id ?? i}
              className="border-b transition-colors hover:bg-white/[0.025]"
              style={{ borderColor: 'rgba(255,255,255,0.04)' }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`py-2.5 pr-4 text-gray-300 ${col.align === 'right' ? 'text-right' : ''}`}
                >
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
