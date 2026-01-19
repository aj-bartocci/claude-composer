import type { Bean, BeanPriority } from '../../shared/types'

const priorityColors: Record<BeanPriority, string> = {
  critical: 'bg-red-500',
  high: 'bg-yellow-500',
  normal: 'bg-white dark:bg-gray-300',
  low: 'bg-gray-400',
  deferred: 'bg-gray-400',
}

interface BeanCardProps {
  bean: Bean
  onViewDetails: () => void
}

export function BeanCard({ bean, onViewDetails }: BeanCardProps) {
  return (
    <div className="bg-item-bg rounded-lg p-3 shadow-sm border border-border">
      {/* Header: priority dot + title */}
      <div className="flex items-start gap-2 mb-2">
        <span
          className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${priorityColors[bean.priority]}`}
          title={`Priority: ${bean.priority}`}
        />
        <h3 className="text-sm font-medium text-foreground line-clamp-2">
          {bean.title}
        </h3>
      </div>

      {/* Type badge + tags */}
      <div className="flex flex-wrap gap-1 mb-2">
        {bean.type && (
          <span className="px-1.5 py-0.5 text-xs rounded bg-accent/20 text-accent">
            {bean.type}
          </span>
        )}
        {bean.tags.map(tag => (
          <span
            key={tag}
            className="px-1.5 py-0.5 text-xs rounded bg-muted/20 text-muted"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* View details button */}
      <button
        onClick={onViewDetails}
        className="text-xs text-accent hover:underline"
      >
        View details
      </button>
    </div>
  )
}
