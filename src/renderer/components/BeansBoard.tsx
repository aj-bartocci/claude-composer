import { useState, useCallback, useEffect } from 'react'
import type { Bean, BeanStatus, ClaudeAPI } from '../../shared/types'
import { BeanCard } from './BeanCard'
import { BeanModal } from './BeanModal'

type ColumnId = Exclude<BeanStatus, 'scrapped'>

interface Column {
  id: ColumnId
  label: string
  headerColor: string
}

const columns: Column[] = [
  { id: 'draft', label: 'Draft', headerColor: 'bg-gray-500' },
  { id: 'todo', label: 'Todo', headerColor: 'bg-yellow-500' },
  { id: 'in-progress', label: 'In Progress', headerColor: 'bg-blue-500' },
  { id: 'completed', label: 'Completed', headerColor: 'bg-green-500' },
]

const defaultColumns = new Set(columns.map(c => c.id))

interface BeansBoardProps {
  beans: Bean[]
  projectId: string
  api: ClaudeAPI
}

export function BeansBoard({ beans, projectId, api }: BeansBoardProps) {
  const [selectedBean, setSelectedBean] = useState<Bean | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnId>>(defaultColumns)

  // Load visible columns from electron-store on mount and project change
  useEffect(() => {
    api.beans.getVisibleColumns(projectId).then(stored => {
      if (stored && stored.length > 0) {
        setVisibleColumns(new Set(stored as ColumnId[]))
      } else {
        setVisibleColumns(defaultColumns)
      }
    })
  }, [api, projectId])

  const toggleColumn = useCallback((columnId: ColumnId) => {
    setVisibleColumns(prev => {
      const next = new Set(prev)
      if (next.has(columnId)) {
        // Don't allow hiding all columns
        if (next.size > 1) {
          next.delete(columnId)
        }
      } else {
        next.add(columnId)
      }
      api.beans.setVisibleColumns(projectId, [...next])
      return next
    })
  }, [api, projectId])

  // Group beans by status
  const beansByStatus = beans.reduce((acc, bean) => {
    const status = bean.status as ColumnId
    if (!acc[status]) acc[status] = []
    acc[status].push(bean)
    return acc
  }, {} as Record<ColumnId, Bean[]>)

  return (
    <div className="h-full flex flex-col">
      {/* Column toggles */}
      <div className="flex items-center gap-2 p-3 border-b border-border bg-sidebar">
        <span className="text-xs text-muted uppercase font-semibold">Columns:</span>
        {columns.map(col => (
          <button
            key={col.id}
            onClick={() => toggleColumn(col.id)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              visibleColumns.has(col.id)
                ? 'bg-item-selected text-foreground'
                : 'bg-item-bg text-muted hover:bg-item-hover'
            }`}
          >
            {col.label}
          </button>
        ))}
      </div>

      {/* Board columns */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {columns
            .filter(col => visibleColumns.has(col.id))
            .map(col => {
              const columnBeans = beansByStatus[col.id] || []
              return (
                <div
                  key={col.id}
                  className="w-72 flex-shrink-0 flex flex-col bg-sidebar rounded-lg border border-border"
                >
                  {/* Column header */}
                  <div className={`px-3 py-2 rounded-t-lg ${col.headerColor}`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">
                        {col.label}
                      </h3>
                      <span className="text-xs text-white/80">
                        {columnBeans.length}
                      </span>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {columnBeans.length === 0 ? (
                      <p className="text-xs text-muted text-center py-4">
                        No items
                      </p>
                    ) : (
                      columnBeans.map(bean => (
                        <BeanCard
                          key={bean.id}
                          bean={bean}
                          onViewDetails={() => setSelectedBean(bean)}
                        />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* Modal */}
      {selectedBean && (
        <BeanModal
          bean={selectedBean}
          onClose={() => setSelectedBean(null)}
        />
      )}
    </div>
  )
}
