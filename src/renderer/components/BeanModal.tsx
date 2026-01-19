import { useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Bean, BeanPriority, BeanStatus } from '../../shared/types'

const priorityColors: Record<BeanPriority, string> = {
  critical: 'bg-red-500',
  high: 'bg-yellow-500',
  normal: 'bg-white dark:bg-gray-300',
  low: 'bg-gray-400',
  deferred: 'bg-gray-400',
}

const statusColors: Record<BeanStatus, string> = {
  draft: 'bg-gray-500',
  todo: 'bg-yellow-500',
  'in-progress': 'bg-blue-500',
  completed: 'bg-green-500',
  scrapped: 'bg-red-500',
}

interface BeanModalProps {
  bean: Bean
  onClose: () => void
}

export function BeanModal({ bean, onClose }: BeanModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-panel border border-border rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground pr-8">
              {bean.title}
            </h2>
            <button
              onClick={onClose}
              className="text-muted hover:text-foreground text-xl leading-none absolute top-4 right-4"
            >
              ×
            </button>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status badge */}
            <span className={`px-2 py-0.5 text-xs rounded text-white ${statusColors[bean.status]}`}>
              {bean.status}
            </span>

            {/* Priority dot + label */}
            <span className="flex items-center gap-1 text-xs text-muted">
              <span className={`w-2 h-2 rounded-full ${priorityColors[bean.priority]}`} />
              {bean.priority}
            </span>

            {/* Type */}
            {bean.type && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-accent/20 text-accent">
                {bean.type}
              </span>
            )}

            {/* Tags */}
            {bean.tags.map(tag => (
              <span
                key={tag}
                className="px-1.5 py-0.5 text-xs rounded bg-muted/20 text-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {bean.body ? (
            <article className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{bean.body}</ReactMarkdown>
            </article>
          ) : (
            <p className="text-muted text-sm">No description provided.</p>
          )}
        </div>
      </div>
    </div>
  )
}
