import { useState, useCallback, useEffect } from 'react'
import type { Subagent, Todo } from '../../shared/types'

interface SubagentCardProps {
  agent: Subagent
  getAgentTodos: (sessionId: string, agentId: string) => Promise<Todo[]>
  onDismiss?: (id: string) => void
}

export function SubagentCard({ agent, getAgentTodos, onDismiss }: SubagentCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [isStatusHovered, setIsStatusHovered] = useState(false)
  const canDismiss = agent.status !== 'running' && agent.status !== 'initializing'
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const progressPercent = agent.totalTasks > 0
    ? Math.round((agent.completedTasks / agent.totalTasks) * 100)
    : 0

  // Sync todos with cachedTodos when they change (real-time updates)
  useEffect(() => {
    if (agent.cachedTodos && agent.cachedTodos.length > 0) {
      setTodos(agent.cachedTodos)
      setLoaded(true)
    }
  }, [JSON.stringify(agent.cachedTodos)])

  const handleToggle = useCallback(async () => {
    if (!expanded && !loaded) {
      if (agent.cachedTodos && agent.cachedTodos.length > 0) {
        setTodos(agent.cachedTodos)
        setLoaded(true)
      } else {
        // Fallback to fetching (for edge cases)
        setLoading(true)
        try {
          const agentTodos = await getAgentTodos(agent.sessionId, agent.id)
          setTodos(agentTodos)
          setLoaded(true)
        } catch (err) {
          console.error('Failed to load todos:', err)
        } finally {
          setLoading(false)
        }
      }
    }
    setExpanded(!expanded)
  }, [expanded, loaded, agent, getAgentTodos])

  const statusColor = agent.status === 'running'
    ? 'bg-blue-500'
    : agent.status === 'initializing'
    ? 'bg-yellow-500'
    : agent.status === 'completed'
    ? 'bg-green-500'
    : 'bg-red-500'

  return (
    <div
      className="rounded bg-item-bg overflow-hidden"
      onMouseEnter={() => setIsStatusHovered(true)}
      onMouseLeave={() => setIsStatusHovered(false)}
    >
      {/* Clickable header */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleToggle() }}
        className="w-full p-2 text-left hover:bg-item-hover transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {/* Status dot / Dismiss button */}
          <div className="relative flex-shrink-0">
            {canDismiss && isStatusHovered ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDismiss?.(agent.id)
                }}
                className="w-4 h-4 -m-1 flex items-center justify-center text-muted hover:text-red-500 rounded"
                title="Dismiss"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            ) : (
              <span className={`w-2 h-2 rounded-full block ${statusColor} ${
                agent.status === 'running' || agent.status === 'initializing' ? 'animate-pulse' : ''
              }`} />
            )}
          </div>

          {/* Agent name */}
          <span className="flex-1 text-sm truncate">{agent.name}</span>

          {/* Progress count */}
          <span className="text-xs text-muted flex-shrink-0">
            {agent.completedTasks}/{agent.totalTasks}
          </span>

          {/* Expand chevron */}
          <span className="text-muted text-xs flex-shrink-0">
            {expanded ? '▾' : '▸'}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-1.5 h-1 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              agent.status === 'completed' ? 'bg-green-500' : 'bg-accent'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Current task (when not expanded) */}
        {!expanded && agent.inProgressTask && (
          <div className="mt-1 text-xs text-muted truncate">
            {agent.inProgressTask}
          </div>
        )}
      </div>

      {/* Expanded todo list */}
      {expanded && (
        <div className="px-2 pb-2 border-t border-border">
          {loading ? (
            <div className="py-2 text-xs text-muted">Loading...</div>
          ) : todos.length === 0 ? (
            <div className="py-2 text-xs text-muted">No todos</div>
          ) : (
            <ul className="py-1 space-y-0.5">
              {todos.map((todo) => (
                <li
                  key={todo.id || `${todo.content}-${todo.status}`}
                  className={`flex items-start gap-2 text-xs py-0.5 ${
                    todo.status === 'completed' ? 'text-muted line-through' : ''
                  } ${todo.status === 'in_progress' ? 'text-accent' : ''}`}
                >
                  <span className="flex-shrink-0 w-4 text-center">
                    {todo.status === 'completed' && '✓'}
                    {todo.status === 'in_progress' && '●'}
                    {todo.status === 'pending' && '○'}
                  </span>
                  <span className="flex-1">{todo.content}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
