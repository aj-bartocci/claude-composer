import { useState, useEffect, useMemo } from 'react'
import type { ClaudeTask, ClaudeAPI, Session } from '../../shared/types'

interface ClaudeBoardProps {
  api: ClaudeAPI
}

const SWIMLANES = ['pending', 'in_progress', 'completed'] as const
type Swimlane = typeof SWIMLANES[number]

const SWIMLANE_LABELS: Record<Swimlane, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
}

const SWIMLANE_COLORS: Record<Swimlane, string> = {
  pending: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
}

interface SessionGroup {
  sessionId: string
  tasks: ClaudeTask[]
  swimlane: Swimlane
}

// Determine which swimlane a session belongs to based on its tasks
function getSessionSwimlane(tasks: ClaudeTask[]): Swimlane {
  if (tasks.length === 0) return 'pending'

  const allPending = tasks.every(t => t.status === 'pending')
  const allCompleted = tasks.every(t => t.status === 'completed')

  if (allPending) return 'pending'
  if (allCompleted) return 'completed'
  return 'in_progress'
}

// Load custom session titles from localStorage
function loadCustomTitles(): Map<string, string> {
  try {
    const stored = localStorage.getItem('claude-board-session-titles')
    if (stored) {
      return new Map(Object.entries(JSON.parse(stored)))
    }
  } catch {}
  return new Map()
}

function saveCustomTitles(titles: Map<string, string>) {
  localStorage.setItem('claude-board-session-titles', JSON.stringify(Object.fromEntries(titles)))
}

export function ClaudeBoard({ api }: ClaudeBoardProps) {
  const [tasks, setTasks] = useState<ClaudeTask[]>([])
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map())
  const [customTitles, setCustomTitles] = useState<Map<string, string>>(loadCustomTitles)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())

  useEffect(() => {
    const loadData = async () => {
      try {
        const [allTasks, allSessions] = await Promise.all([
          api.claudeTasks.getAllTasks(),
          api.chat.getSessions(),
        ])
        setTasks(allTasks)

        const sessionMap = new Map<string, Session>()
        for (const session of allSessions) {
          sessionMap.set(session.id, session)
        }
        setSessions(sessionMap)
      } catch (err) {
        console.error('Failed to load Claude tasks:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
    api.claudeTasks.startWatcher()

    const unsubscribe = api.claudeTasks.onTasksChange((updatedTasks) => {
      setTasks(updatedTasks as ClaudeTask[])
    })

    return () => {
      unsubscribe()
      api.claudeTasks.stopWatcher()
    }
  }, [api])

  // Group tasks by session and determine swimlane
  const sessionGroups = useMemo(() => {
    const groups = new Map<string, ClaudeTask[]>()

    for (const task of tasks) {
      const existing = groups.get(task.sessionId) || []
      existing.push(task)
      groups.set(task.sessionId, existing)
    }

    const result: SessionGroup[] = []
    for (const [sessionId, sessionTasks] of groups) {
      const swimlane = getSessionSwimlane(sessionTasks)
      result.push({ sessionId, tasks: sessionTasks, swimlane })
    }

    return result
  }, [tasks])

  // Group sessions by swimlane
  const sessionsBySwimlane = useMemo(() => {
    const result: Record<Swimlane, SessionGroup[]> = {
      pending: [],
      in_progress: [],
      completed: [],
    }

    for (const group of sessionGroups) {
      result[group.swimlane].push(group)
    }

    return result
  }, [sessionGroups])

  const toggleExpanded = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) {
        next.delete(sessionId)
      } else {
        next.add(sessionId)
      }
      return next
    })
  }

  const toggleTaskExpanded = (sessionId: string, taskId: string) => {
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

  const startEditing = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId)
    setEditValue(currentTitle)
  }

  const saveTitle = (sessionId: string) => {
    const trimmed = editValue.trim()
    setCustomTitles(prev => {
      const next = new Map(prev)
      if (trimmed) {
        next.set(sessionId, trimmed)
      } else {
        next.delete(sessionId)
      }
      saveCustomTitles(next)
      return next
    })
    setEditingSessionId(null)
  }

  const cancelEditing = () => {
    setEditingSessionId(null)
    setEditValue('')
  }

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
        <span className="text-xs text-muted">
          {sessionGroups.length} session{sessionGroups.length !== 1 ? 's' : ''} · {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Kanban swimlanes */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {SWIMLANES.map(swimlane => (
            <div
              key={swimlane}
              className="flex flex-col w-80 bg-sidebar rounded-lg border border-border"
            >
              {/* Swimlane header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <span className={`w-2 h-2 rounded-full ${SWIMLANE_COLORS[swimlane]}`} />
                <span className="text-sm font-medium">{SWIMLANE_LABELS[swimlane]}</span>
                <span className="text-xs text-muted ml-auto">
                  {sessionsBySwimlane[swimlane].length}
                </span>
              </div>

              {/* Session cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-3">
                {sessionsBySwimlane[swimlane].map(({ sessionId, tasks: sessionTasks }) => {
                  const session = sessions.get(sessionId)
                  const defaultTitle = session?.preview || `Session ${sessionId.slice(0, 8)}`
                  const sessionTitle = customTitles.get(sessionId) || defaultTitle
                  const isEditing = editingSessionId === sessionId
                  const isExpanded = expandedSessions.has(sessionId)

                  const completedCount = sessionTasks.filter(t => t.status === 'completed').length
                  const inProgressCount = sessionTasks.filter(t => t.status === 'in_progress').length
                  const totalCount = sessionTasks.length
                  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

                  return (
                    <div
                      key={sessionId}
                      className="bg-panel rounded-md border border-border overflow-hidden hover:border-accent/50 transition-colors"
                    >
                      {/* Session header */}
                      <div
                        className="p-3 cursor-pointer"
                        onClick={() => !isEditing && toggleExpanded(sessionId)}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveTitle(sessionId)
                                  else if (e.key === 'Escape') cancelEditing()
                                }}
                                onBlur={() => saveTitle(sessionId)}
                                onClick={(e) => e.stopPropagation()}
                                className="text-sm font-medium bg-background border border-accent rounded px-2 py-0.5 outline-none w-full"
                                placeholder={defaultTitle}
                                autoFocus
                              />
                            ) : (
                              <span
                                className="text-sm font-medium line-clamp-2 hover:text-accent transition-colors"
                                title={`${sessionTitle} (double-click to rename)`}
                                onDoubleClick={(e) => {
                                  e.stopPropagation()
                                  startEditing(sessionId, sessionTitle)
                                }}
                              >
                                {sessionTitle}
                              </span>
                            )}
                          </div>
                          <span className="text-muted text-xs flex-shrink-0">
                            {isExpanded ? '▾' : '▸'}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted">
                            {completedCount}/{totalCount}
                          </span>
                        </div>

                        {/* Status summary */}
                        {inProgressCount > 0 && (
                          <div className="mt-2 text-xs text-accent">
                            {inProgressCount} task{inProgressCount !== 1 ? 's' : ''} in progress
                          </div>
                        )}
                      </div>

                      {/* Expanded task list */}
                      {isExpanded && (
                        <div className="border-t border-border px-3 py-2 space-y-2 bg-background/30">
                          {sessionTasks.map(task => {
                            const taskKey = `${sessionId}:${task.id}`
                            const isTaskExpanded = expandedTasks.has(taskKey)

                            return (
                              <div
                                key={task.id}
                                className="rounded border border-border bg-panel p-2 cursor-pointer hover:border-accent/50 transition-colors"
                                onClick={() => toggleTaskExpanded(sessionId, task.id)}
                              >
                                <div className="flex items-start gap-2 text-sm">
                                  <span className={`w-2 h-2 rounded-full ${SWIMLANE_COLORS[task.status]} flex-shrink-0 mt-1.5`} />
                                  <span className="text-xs text-muted font-mono flex-shrink-0 mt-0.5">#{task.id}</span>
                                  <div className="flex-1 min-w-0">
                                    <span className={isTaskExpanded ? '' : 'truncate block'}>{task.subject}</span>
                                    {task.activeForm && task.status === 'in_progress' && (
                                      <div className="text-xs text-accent mt-0.5 flex items-center gap-1">
                                        <span className="animate-pulse">*</span>
                                        <span className="truncate">{task.activeForm}</span>
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-muted text-xs flex-shrink-0">
                                    {isTaskExpanded ? '▾' : '▸'}
                                  </span>
                                </div>

                                {/* Expanded task details */}
                                {isTaskExpanded && (
                                  <div className="mt-2 pt-2 border-t border-border space-y-2">
                                    {task.description && (
                                      <p className="text-sm text-muted whitespace-pre-wrap">
                                        {task.description}
                                      </p>
                                    )}

                                    {/* Dependencies */}
                                    {(task.blocks.length > 0 || task.blockedBy.length > 0) && (
                                      <div className="flex flex-wrap gap-1">
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
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}

                {sessionsBySwimlane[swimlane].length === 0 && (
                  <div className="text-xs text-muted text-center py-8">
                    No sessions
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
