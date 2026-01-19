import { readFile, readdir, stat, access } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import type { Subagent, Todo } from '../../shared/types'

const CLAUDE_DIR = join(homedir(), '.claude')
const TODOS_DIR = join(CLAUDE_DIR, 'todos')
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects')
const STALE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

// Feature flag: show initializing subagents with no todos (for debugging)
// Set to true to see all subagents including empty initializing ones
const SHOW_EMPTY_INITIALIZING = false

interface RawTodo {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
  id?: string
}

interface SubagentFromJsonl {
  sessionId: string
  agentId: string
  todos: RawTodo[]
  mtime: number
  startedAt: Date
}

// Parse todos from the last TodoWrite call in a subagent JSONL file
async function parseSubagentJsonl(filePath: string, sessionId: string, agentId: string): Promise<SubagentFromJsonl | null> {
  try {
    const [content, stats] = await Promise.all([
      readFile(filePath, 'utf-8'),
      stat(filePath)
    ])

    const lines = content.trim().split('\n').filter(Boolean)
    let lastTodos: RawTodo[] = []
    let startedAt = new Date(stats.mtimeMs) // Fallback to mtime

    // Get start time from first line's timestamp
    if (lines.length > 0) {
      try {
        const firstEntry = JSON.parse(lines[0])
        if (firstEntry.timestamp) {
          startedAt = new Date(firstEntry.timestamp)
        }
      } catch {
        // Use fallback
      }
    }

    // Find the last TodoWrite call (scan from end for efficiency with large files)
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i])
        const toolUse = entry?.message?.content?.[0]
        if (toolUse?.name === 'TodoWrite' && toolUse?.input?.todos) {
          lastTodos = toolUse.input.todos
          break
        }
      } catch {
        // Invalid line, skip
      }
    }

    return {
      sessionId,
      agentId,
      todos: lastTodos,
      mtime: stats.mtimeMs,
      startedAt
    }
  } catch {
    return null
  }
}

// Scan all subagent JSONL files in the projects directory
async function getSubagentsFromJsonl(): Promise<SubagentFromJsonl[]> {
  const subagents: SubagentFromJsonl[] = []

  try {
    const projects = await readdir(PROJECTS_DIR)

    for (const project of projects) {
      const projectDir = join(PROJECTS_DIR, project)

      try {
        const entries = await readdir(projectDir)

        for (const entry of entries) {
          // Look for session directories (UUID format)
          if (!entry.match(/^[a-f0-9-]{36}$/)) continue

          const subagentsDir = join(projectDir, entry, 'subagents')
          try {
            const agentFiles = await readdir(subagentsDir)

            for (const agentFile of agentFiles) {
              // Match agent-{agentId}.jsonl
              const match = agentFile.match(/^agent-([a-f0-9-]+)\.jsonl$/)
              if (!match) continue

              const agentId = match[1]
              const sessionId = entry
              const filePath = join(subagentsDir, agentFile)

              const subagent = await parseSubagentJsonl(filePath, sessionId, agentId)
              if (subagent) {
                subagents.push(subagent)
              }
            }
          } catch {
            // No subagents dir or can't read it
          }
        }
      } catch {
        // Can't read project dir
      }
    }
  } catch {
    // Projects dir doesn't exist
  }

  return subagents
}

async function getValidSessionIds(): Promise<Set<string>> {
  const sessionIds = new Set<string>()
  const projectsDir = join(CLAUDE_DIR, 'projects')

  try {
    const projects = await readdir(projectsDir)
    await Promise.all(projects.map(async (project) => {
      try {
        const indexPath = join(projectsDir, project, 'sessions-index.json')
        const content = await readFile(indexPath, 'utf-8')
        const parsed = JSON.parse(content)
        // Handle both formats: { entries: [...] } and plain array
        const sessions = Array.isArray(parsed) ? parsed : (parsed.entries ?? [])
        for (const session of sessions) {
          if (session.sessionId) sessionIds.add(session.sessionId)
        }
      } catch {
        // Project has no sessions-index or invalid format
      }
    }))
  } catch {
    // Projects dir doesn't exist
  }

  return sessionIds
}

export async function getActiveSubagents(): Promise<Subagent[]> {
  const subagents: Subagent[] = []
  const seenAgents = new Set<string>() // Track by agentId to avoid duplicates

  // First, get subagents from JSONL files (more reliable source)
  const jsonlSubagents = await getSubagentsFromJsonl()
  for (const sub of jsonlSubagents) {
    const todos = sub.todos
    const totalTasks = todos.length
    const completedTasks = todos.filter(t => t.status === 'completed').length
    const inProgressTodo = todos.find(t => t.status === 'in_progress')
    const pendingTodo = todos.find(t => t.status === 'pending')

    const isStale = Date.now() - sub.mtime > STALE_THRESHOLD_MS

    let status: 'running' | 'completed' | 'failed' | 'initializing' = 'completed'
    if (totalTasks === 0) {
      status = isStale ? 'failed' : 'initializing'
    } else {
      const allCompleted = completedTasks === totalTasks
      const hasIncomplete = !!inProgressTodo || !!pendingTodo

      if (allCompleted) {
        status = 'completed'
      } else if (hasIncomplete && isStale) {
        status = 'failed'
      } else if (hasIncomplete) {
        status = 'running'
      }
    }

    const activeTodo = inProgressTodo ?? pendingTodo ?? todos[0]
    const firstTodo = todos[0]

    subagents.push({
      id: sub.agentId,
      sessionId: sub.sessionId,
      status,
      name: firstTodo?.content ?? 'Initializing...',
      description: activeTodo?.activeForm ?? activeTodo?.content ?? 'Starting up...',
      startedAt: sub.startedAt,
      totalTasks,
      completedTasks,
      inProgressTask: inProgressTodo?.activeForm ?? inProgressTodo?.content,
    })
    seenAgents.add(sub.agentId)
  }

  // Also check todos directory for legacy/additional subagents
  const validSessionIds = await getValidSessionIds()

  try {
    const files = await readdir(TODOS_DIR)

    for (const file of files) {
      if (!file.endsWith('.json')) continue

      // Parse filename: sessionId-agent-agentId.json
      const match = file.match(/^([a-f0-9-]+)-agent-([a-f0-9-]+)\.json$/)
      if (!match) continue

      const [, sessionId, agentId] = match

      // Skip if we already have this agent from JSONL
      if (seenAgents.has(agentId)) continue

      // Skip orphaned subagents (session no longer exists)
      // Check both the index AND if session file exists (for active sessions not yet indexed)
      if (!validSessionIds.has(sessionId)) {
        // Check if session file exists directly
        let sessionExists = false
        try {
          const projects = await readdir(PROJECTS_DIR)
          for (const project of projects) {
            try {
              await access(join(PROJECTS_DIR, project, `${sessionId}.jsonl`))
              sessionExists = true
              break
            } catch {
              // File doesn't exist in this project
            }
          }
        } catch {
          // Projects dir doesn't exist
        }
        if (!sessionExists) continue
      }

      try {
        const filePath = join(TODOS_DIR, file)
        const [content, stats] = await Promise.all([
          readFile(filePath, 'utf-8'),
          stat(filePath)
        ])
        const todos: RawTodo[] = JSON.parse(content)

        // Compute progress
        const totalTasks = todos.length
        const completedTasks = todos.filter(t => t.status === 'completed').length
        const inProgressTodo = todos.find(t => t.status === 'in_progress')
        const pendingTodo = todos.find(t => t.status === 'pending')

        // Determine status based on todos and file staleness
        const isStale = Date.now() - stats.mtimeMs > STALE_THRESHOLD_MS

        let status: 'running' | 'completed' | 'failed' | 'initializing' = 'completed'
        if (totalTasks === 0) {
          // No todos yet - subagent is initializing
          status = isStale ? 'failed' : 'initializing'
        } else {
          const allCompleted = completedTasks === totalTasks
          const hasIncomplete = !!inProgressTodo || !!pendingTodo

          if (allCompleted) {
            status = 'completed'
          } else if (hasIncomplete && isStale) {
            status = 'failed' // Abandoned with incomplete tasks
          } else if (hasIncomplete) {
            status = 'running'
          }
        }

        // Get description from first in-progress or first pending todo
        const activeTodo = inProgressTodo ?? pendingTodo ?? todos[0]
        // Name is always the first todo's content (stable description of overall task)
        const firstTodo = todos[0]

        subagents.push({
          id: agentId,
          sessionId,
          status,
          name: firstTodo?.content ?? 'Initializing...',
          description: activeTodo?.activeForm ?? activeTodo?.content ?? 'Starting up...',
          startedAt: new Date(), // We don't have this info in todos file
          totalTasks,
          completedTasks,
          inProgressTask: inProgressTodo?.activeForm ?? inProgressTodo?.content,
        })
      } catch {
        // Invalid file, skip
      }
    }
  } catch {
    // Todos dir doesn't exist
  }

  // Filter out subagents with no todos unless debug flag is set
  const filtered = SHOW_EMPTY_INITIALIZING
    ? subagents
    : subagents.filter(s => s.totalTasks > 0)

  // Sort by running/initializing first, then by start time (most recent first)
  return filtered.sort((a, b) => {
    const aActive = a.status === 'running' || a.status === 'initializing'
    const bActive = b.status === 'running' || b.status === 'initializing'
    if (aActive && !bActive) return -1
    if (bActive && !aActive) return 1
    // Most recent first
    return b.startedAt.getTime() - a.startedAt.getTime()
  })
}

export async function getTodos(sessionId: string): Promise<Todo[]> {
  const todos: Todo[] = []

  try {
    const files = await readdir(TODOS_DIR)

    for (const file of files) {
      if (!file.startsWith(sessionId) || !file.endsWith('.json')) continue

      try {
        const content = await readFile(join(TODOS_DIR, file), 'utf-8')
        const rawTodos: RawTodo[] = JSON.parse(content)

        for (let i = 0; i < rawTodos.length; i++) {
          const raw = rawTodos[i]
          todos.push({
            id: raw.id ?? `${file}-${i}`,
            content: raw.content,
            status: raw.status,
          })
        }
      } catch {
        // Invalid file, skip
      }
    }
  } catch {
    // Todos dir doesn't exist
  }

  return todos
}

export async function getAgentTodos(sessionId: string, agentId: string): Promise<Todo[]> {
  const todos: Todo[] = []

  // First try the JSON file in todos directory
  const filename = `${sessionId}-agent-${agentId}.json`
  const filepath = join(TODOS_DIR, filename)

  try {
    const content = await readFile(filepath, 'utf-8')
    const rawTodos: RawTodo[] = JSON.parse(content)

    if (rawTodos.length > 0) {
      for (let i = 0; i < rawTodos.length; i++) {
        const raw = rawTodos[i]
        todos.push({
          id: raw.id ?? `${filename}-${i}`,
          content: raw.content,
          status: raw.status,
        })
      }
      return todos
    }
  } catch {
    // File doesn't exist or invalid, try JSONL
  }

  // Fall back to parsing from JSONL file
  try {
    const projects = await readdir(PROJECTS_DIR)
    for (const project of projects) {
      const jsonlPath = join(PROJECTS_DIR, project, sessionId, 'subagents', `agent-${agentId}.jsonl`)
      const subagent = await parseSubagentJsonl(jsonlPath, sessionId, agentId)
      if (subagent && subagent.todos.length > 0) {
        for (let i = 0; i < subagent.todos.length; i++) {
          const raw = subagent.todos[i]
          todos.push({
            id: raw.id ?? `${agentId}-${i}`,
            content: raw.content,
            status: raw.status,
          })
        }
        break
      }
    }
  } catch {
    // Couldn't find JSONL either
  }

  return todos
}
