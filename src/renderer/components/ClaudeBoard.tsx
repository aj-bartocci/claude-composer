import { useState, useEffect } from 'react'
import type { ClaudeTask, ClaudeAPI } from '../../shared/types'

interface ClaudeBoardProps {
  api: ClaudeAPI
}

const STATUS_COLUMNS = ['pending', 'in_progress', 'completed'] as const

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
}

export function ClaudeBoard({ api }: ClaudeBoardProps) {
  const [tasks, setTasks] = useState<ClaudeTask[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const allTasks = await api.claudeTasks.getAllTasks()
        setTasks(allTasks)
      } catch (err) {
        console.error('Failed to load Claude tasks:', err)
      } finally {
        setLoading(false)
      }
    }

    loadTasks()
    api.claudeTasks.startWatcher()

    const unsubscribe = api.claudeTasks.onTasksChange((updatedTasks) => {
      setTasks(updatedTasks as ClaudeTask[])
    })

    return () => {
      unsubscribe()
      api.claudeTasks.stopWatcher()
    }
  }, [api])

  const toggleExpanded = (taskId: string, sessionId: string) => {
    const key = `${sessionId}:${taskId}`
    setExpandedTasks(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // Group tasks by status
  const tasksByStatus = STATUS_COLUMNS.reduce((acc, status) => {
    acc[status] = tasks.filter(t => t.status === status)
    return acc
  }, {} as Record<string, ClaudeTask[]>)

  if (loading) {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <p className="text-muted">Loading tasks...</p>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="h-full bg-background flex flex-col items-center justify-center gap-4">
        <div className="text-center">
          <h2 className="text-lg font-medium mb-2">No Claude Tasks</h2>
          <p className="text-muted text-sm max-w-md">
            Claude tasks appear here when Claude Code uses the TaskCreate tool during a session.
            These are used to track progress on multi-step implementations.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium">Claude Board</h2>
        <span className="text-xs text-muted">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {STATUS_COLUMNS.map(status => (
            <div
              key={status}
              className="flex flex-col w-80 bg-sidebar rounded-lg border border-border"
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]}`} />
                <span className="text-sm font-medium">{STATUS_LABELS[status]}</span>
                <span className="text-xs text-muted ml-auto">
                  {tasksByStatus[status].length}
                </span>
              </div>

              {/* Column content */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {tasksByStatus[status].map(task => {
                  const key = `${task.sessionId}:${task.id}`
                  const isExpanded = expandedTasks.has(key)

                  return (
                    <div
                      key={key}
                      className="bg-panel rounded-md border border-border p-3 cursor-pointer hover:border-accent/50 transition-colors"
                      onClick={() => toggleExpanded(task.id, task.sessionId)}
                    >
                      {/* Task header */}
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted font-mono">#{task.id}</span>
                        <h3 className="text-sm font-medium flex-1">{task.subject}</h3>
                      </div>

                      {/* Active form indicator */}
                      {task.activeForm && task.status === 'in_progress' && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-accent">
                          <span className="animate-pulse">*</span>
                          <span>{task.activeForm}</span>
                        </div>
                      )}

                      {/* Expanded description */}
                      {isExpanded && task.description && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-sm text-muted whitespace-pre-wrap">
                            {task.description}
                          </p>
                        </div>
                      )}

                      {/* Dependencies */}
                      {(task.blocks.length > 0 || task.blockedBy.length > 0) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {task.blockedBy.map(id => (
                            <span
                              key={`blockedBy-${id}`}
                              className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400"
                            >
                              blocked by #{id}
                            </span>
                          ))}
                          {task.blocks.map(id => (
                            <span
                              key={`blocks-${id}`}
                              className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400"
                            >
                              blocks #{id}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Session info */}
                      <div className="mt-2 text-xs text-muted truncate" title={task.sessionId}>
                        Session: {task.sessionId.slice(0, 8)}...
                      </div>
                    </div>
                  )
                })}

                {tasksByStatus[status].length === 0 && (
                  <div className="text-xs text-muted text-center py-4">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
