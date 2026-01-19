import { readFile, readdir, stat, open } from 'fs/promises'
import { join, basename } from 'path'
import { homedir } from 'os'
import type { Session, Message, MessageContent } from '../../shared/types'

const CLAUDE_DIR = join(homedir(), '.claude')
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects')

interface SessionIndexEntry {
  sessionId: string
  fullPath: string
  fileMtime: number
  firstPrompt: string
  messageCount: number
  created: string
  modified: string
  gitBranch: string
  projectPath: string
  isSidechain: boolean
}

interface SessionsIndex {
  version: number
  entries: SessionIndexEntry[]
}

interface RawMessage {
  type: string
  uuid: string
  timestamp: string
  message?: {
    role: 'user' | 'assistant'
    content: string | Array<{ type: string; text?: string; thinking?: string; tool_use_id?: string; name?: string; id?: string; input?: unknown; content?: string }>
  }
  sessionId?: string
}

// Cache for append-only optimization
const sessionBytesRead = new Map<string, number>()
const sessionMessages = new Map<string, Message[]>()

/**
 * Parse session info from a JSONL file.
 * Reads enough to find cwd (project path) and first user message.
 */
async function parseSessionFromJsonl(filePath: string, fallbackProjectPath: string): Promise<Session | null> {
  try {
    // Read enough to find cwd and first message (usually within first 16KB)
    const handle = await open(filePath, 'r')
    const buffer = Buffer.alloc(16384)
    const { bytesRead } = await handle.read(buffer, 0, 16384, 0)
    await handle.close()

    if (bytesRead === 0) return null

    const content = buffer.toString('utf-8', 0, bytesRead)
    const lines = content.split('\n').filter(l => l.trim())

    const sessionId = basename(filePath, '.jsonl')
    let projectPath = fallbackProjectPath
    let preview = ''
    let timestamp: string | undefined

    // Parse lines to find cwd and first user message
    for (const line of lines) {
      try {
        const msg = JSON.parse(line)

        // Get cwd (project path) from any message that has it
        if (msg.cwd && !projectPath.includes(msg.cwd)) {
          projectPath = msg.cwd
        }

        // Get timestamp from first message that has it
        if (msg.timestamp && !timestamp) {
          timestamp = msg.timestamp
        }

        // Get preview from first user message
        if (!preview && msg.type === 'user' && msg.message?.content) {
          const contentData = msg.message.content
          if (typeof contentData === 'string') {
            preview = contentData.slice(0, 100)
          } else if (Array.isArray(contentData)) {
            for (const block of contentData) {
              if (block.type === 'text' && block.text) {
                preview = block.text.slice(0, 100)
                break
              }
            }
          }
        }

        // Stop once we have all needed info
        if (projectPath !== fallbackProjectPath && preview && timestamp) {
          break
        }
      } catch {
        // Invalid JSON line, continue
      }
    }

    // Get file stats for timestamps
    const fileStat = await stat(filePath)

    return {
      id: sessionId,
      projectPath,
      startedAt: new Date(timestamp || fileStat.birthtime),
      lastMessageAt: fileStat.mtime,
      preview: preview || 'New session',
      messageCount: 0,
    }
  } catch {
    return null
  }
}

export async function getSessions(projectId?: string): Promise<Session[]> {
  const indexedSessions = new Map<string, Session>()

  try {
    const projectDirs = await readdir(PROJECTS_DIR)

    for (const projectDir of projectDirs) {
      // If filtering by project, check if directory matches
      if (projectId && projectDir !== projectId) {
        continue
      }

      const projectPath = join(PROJECTS_DIR, projectDir)
      const indexPath = join(projectPath, 'sessions-index.json')
      const decodedProjectPath = decodeProjectPath(projectDir)

      // Load indexed sessions (has rich metadata)
      try {
        const indexContent = await readFile(indexPath, 'utf-8')
        const index: SessionsIndex = JSON.parse(indexContent)

        for (const entry of index.entries) {
          indexedSessions.set(entry.sessionId, {
            id: entry.sessionId,
            projectPath: entry.projectPath,
            startedAt: new Date(entry.created),
            lastMessageAt: new Date(entry.modified),
            preview: entry.firstPrompt.slice(0, 100),
            messageCount: entry.messageCount,
          })
        }
      } catch {
        // Index doesn't exist or is invalid - that's fine, we'll scan for JSONL files
      }

      // Scan for unindexed .jsonl files
      try {
        const files = await readdir(projectPath)
        for (const file of files) {
          if (!file.endsWith('.jsonl') || file.startsWith('agent-')) continue

          const sessionId = basename(file, '.jsonl')

          // Skip if already indexed
          if (indexedSessions.has(sessionId)) continue

          const session = await parseSessionFromJsonl(
            join(projectPath, file),
            decodedProjectPath
          )
          if (session) {
            indexedSessions.set(sessionId, session)
          }
        }
      } catch {
        // Can't read project directory
      }
    }
  } catch {
    // Projects dir doesn't exist
  }

  // Sort by last message time, most recent first
  return Array.from(indexedSessions.values())
    .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
}

/**
 * Decode a Claude project directory name to the original path.
 */
function decodeProjectPath(dirName: string): string {
  if (dirName.startsWith('-')) {
    return '/' + dirName.slice(1).replace(/-/g, '/')
  }
  return dirName.replace(/-/g, '/')
}

export async function getMessages(sessionId: string): Promise<Message[]> {
  // Find the session file
  const sessionPath = await findSessionPath(sessionId)
  if (!sessionPath) {
    return []
  }

  // Check if we have cached messages and if file has grown
  const fileStat = await stat(sessionPath)
  const lastBytesRead = sessionBytesRead.get(sessionId) ?? 0

  if (lastBytesRead > 0 && lastBytesRead >= fileStat.size) {
    // File hasn't grown, return cached messages
    return sessionMessages.get(sessionId) ?? []
  }

  // Read only new bytes (append-only optimization)
  const content = await readFile(sessionPath, 'utf-8')
  const lines = content.split('\n').filter(line => line.trim())

  const messages: Message[] = []

  for (const line of lines) {
    try {
      const raw: RawMessage = JSON.parse(line)

      // Only process user and assistant messages
      if (raw.type !== 'user' && raw.type !== 'assistant') {
        continue
      }

      if (!raw.message) {
        continue
      }

      const content = parseContent(raw.message.content)

      messages.push({
        messageId: raw.uuid,
        sessionId: raw.sessionId ?? sessionId,
        type: 'message',
        role: raw.message.role,
        content,
        timestamp: new Date(raw.timestamp),
      })
    } catch {
      // Invalid JSON line, skip
    }
  }

  // Cache the results
  sessionBytesRead.set(sessionId, fileStat.size)
  sessionMessages.set(sessionId, messages)

  return messages
}

function parseContent(content: string | Array<{ type: string; text?: string; thinking?: string; tool_use_id?: string; name?: string; id?: string; input?: unknown; content?: string }>): MessageContent[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }]
  }

  const result: MessageContent[] = []

  for (const item of content) {
    if (item.type === 'text' && item.text) {
      result.push({ type: 'text', text: item.text })
    } else if (item.type === 'tool_use' && item.id && item.name) {
      result.push({ type: 'tool_use', id: item.id, name: item.name, input: item.input })
    } else if (item.type === 'tool_result' && item.tool_use_id) {
      result.push({ type: 'tool_result', tool_use_id: item.tool_use_id, content: item.content ?? '' })
    }
    // Skip thinking blocks - they're internal
  }

  return result
}

async function findSessionPath(sessionId: string): Promise<string | null> {
  try {
    const projectDirs = await readdir(PROJECTS_DIR)

    for (const projectDir of projectDirs) {
      const sessionPath = join(PROJECTS_DIR, projectDir, `${sessionId}.jsonl`)
      try {
        await stat(sessionPath)
        return sessionPath
      } catch {
        // File doesn't exist in this project
      }
    }
  } catch {
    // Projects dir doesn't exist
  }

  return null
}

// Clear cache for a session (call when file watcher detects change)
export function invalidateSessionCache(sessionId: string) {
  sessionBytesRead.delete(sessionId)
  sessionMessages.delete(sessionId)
}

// Get the file path for a session (for "show in finder" feature)
export async function getSessionPath(sessionId: string): Promise<string | null> {
  return findSessionPath(sessionId)
}
