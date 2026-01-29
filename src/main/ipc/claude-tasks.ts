import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import type { ClaudeTask } from '../../shared/types'

const CLAUDE_DIR = join(homedir(), '.claude')
const TASKS_DIR = join(CLAUDE_DIR, 'tasks')

/**
 * Parse a task JSON file
 */
async function parseTaskFile(filePath: string, sessionId: string): Promise<ClaudeTask | null> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const task = JSON.parse(content)
    return {
      ...task,
      sessionId,
    }
  } catch (err) {
    console.error('Failed to parse task file:', filePath, err)
    return null
  }
}

/**
 * Get all tasks from a specific session
 */
export async function getSessionTasks(sessionId: string): Promise<ClaudeTask[]> {
  const sessionDir = join(TASKS_DIR, sessionId)

  try {
    const files = await readdir(sessionDir)
    const jsonFiles = files.filter(f => f.endsWith('.json') && !f.startsWith('.'))

    const tasks = await Promise.all(
      jsonFiles.map(file => parseTaskFile(join(sessionDir, file), sessionId))
    )

    return tasks.filter((t): t is ClaudeTask => t !== null)
  } catch {
    // Session directory doesn't exist or is empty
    return []
  }
}

/**
 * Get all tasks from all sessions
 */
export async function getAllTasks(): Promise<ClaudeTask[]> {
  try {
    const sessionDirs = await readdir(TASKS_DIR)

    const allTasks = await Promise.all(
      sessionDirs.map(async (sessionId) => {
        return getSessionTasks(sessionId)
      })
    )

    return allTasks.flat()
  } catch {
    // Tasks directory doesn't exist
    return []
  }
}

/**
 * Get the tasks directory path for watching
 */
export function getTasksDir(): string {
  return TASKS_DIR
}
