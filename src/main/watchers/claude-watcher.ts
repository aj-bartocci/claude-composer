import chokidar from 'chokidar'
import { join, basename } from 'path'
import { homedir } from 'os'
import type { BrowserWindow } from 'electron'
import { invalidateSessionCache, getSessions } from '../ipc/chat'
import { getActiveSubagents } from '../ipc/subagents'
import { getBeans } from '../ipc/beans'
import { getAllTasks } from '../ipc/claude-tasks'

const CLAUDE_DIR = join(homedir(), '.claude')
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects')
const TODOS_DIR = join(CLAUDE_DIR, 'todos')
const TASKS_DIR = join(CLAUDE_DIR, 'tasks')

let watcher: chokidar.FSWatcher | null = null

// Per-project beans watchers
const beansWatchers = new Map<string, chokidar.FSWatcher>()

export function startClaudeWatchers(mainWindow: BrowserWindow) {
  // Close existing watcher if any
  if (watcher) {
    watcher.close()
  }

  const watchPaths = [
    // Watch sessions-index.json files for new/updated sessions
    join(PROJECTS_DIR, '**/sessions-index.json'),
    // Watch JSONL files for message updates
    join(PROJECTS_DIR, '**/*.jsonl'),
    // Watch todo files for subagent status changes
    join(TODOS_DIR, '*.json'),
  ]

  watcher = chokidar.watch(watchPaths, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  })

  watcher.on('add', (path) => handleFileChange(mainWindow, path, 'add'))
  watcher.on('change', (path) => handleFileChange(mainWindow, path, 'change'))
  watcher.on('unlink', (path) => handleFileChange(mainWindow, path, 'unlink'))

  watcher.on('error', (error) => {
    console.error('Claude watcher error:', error)
  })

  console.log('Claude watchers started')
}

async function handleFileChange(mainWindow: BrowserWindow, filePath: string, eventType: 'add' | 'change' | 'unlink') {
  const filename = basename(filePath)

  // Sessions index changed - emit updated sessions list
  if (filename === 'sessions-index.json') {
    const sessions = await getSessions()
    mainWindow.webContents.send('chat:sessionUpdate', sessions)
    return
  }

  // JSONL file changed - could be session file or subagent file
  if (filePath.endsWith('.jsonl')) {
    // Check if this is a subagent JSONL file (contains /subagents/ in path)
    if (filePath.includes('/subagents/')) {
      // Subagent file changed - emit status change
      const subagents = await getActiveSubagents()
      mainWindow.webContents.send('subagents:statusChange', subagents)
      return
    }

    // Session JSONL file changed - invalidate cache and notify
    const sessionId = basename(filePath, '.jsonl')
    invalidateSessionCache(sessionId)
    mainWindow.webContents.send('chat:messagesUpdate', { sessionId })

    // Also refresh sessions list in case this is a new session
    const sessions = await getSessions()
    mainWindow.webContents.send('chat:sessionUpdate', sessions)
    return
  }

  // Todo file changed - emit subagent status change
  if (filePath.startsWith(TODOS_DIR) && filePath.endsWith('.json')) {
    const subagents = await getActiveSubagents()
    mainWindow.webContents.send('subagents:statusChange', subagents)
    return
  }
}

export function stopClaudeWatchers() {
  if (watcher) {
    watcher.close()
    watcher = null
    console.log('Claude watchers stopped')
  }
}

/**
 * Start watching .beans directory for a specific project
 */
export function startBeansWatcher(mainWindow: BrowserWindow, projectPath: string) {
  // Stop existing watcher for this project if any
  stopBeansWatcher(projectPath)

  const beansPath = join(projectPath, '.beans')
  const watchPattern = join(beansPath, '*.md')

  const beansWatcher = chokidar.watch(watchPattern, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  })

  beansWatcher.on('add', () => emitBeansChange(mainWindow, projectPath))
  beansWatcher.on('change', () => emitBeansChange(mainWindow, projectPath))
  beansWatcher.on('unlink', () => emitBeansChange(mainWindow, projectPath))

  beansWatcher.on('error', (error) => {
    console.error('Beans watcher error:', projectPath, error)
  })

  beansWatchers.set(projectPath, beansWatcher)
  console.log('Beans watcher started for:', projectPath)
}

/**
 * Stop watching .beans directory for a specific project
 */
export function stopBeansWatcher(projectPath: string) {
  const existingWatcher = beansWatchers.get(projectPath)
  if (existingWatcher) {
    existingWatcher.close()
    beansWatchers.delete(projectPath)
    console.log('Beans watcher stopped for:', projectPath)
  }
}

/**
 * Emit beans change event to renderer
 */
async function emitBeansChange(mainWindow: BrowserWindow, projectPath: string) {
  try {
    const beans = await getBeans(projectPath)
    mainWindow.webContents.send('beans:change', beans)
  } catch (err) {
    console.error('Failed to emit beans change:', err)
  }
}

// Claude Tasks watcher
let claudeTasksWatcher: chokidar.FSWatcher | null = null

/**
 * Start watching ~/.claude/tasks/ for task changes
 */
export function startClaudeTasksWatcher(mainWindow: BrowserWindow) {
  stopClaudeTasksWatcher()

  const watchPattern = join(TASKS_DIR, '**/*.json')

  claudeTasksWatcher = chokidar.watch(watchPattern, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  })

  const emitChange = async () => {
    try {
      const tasks = await getAllTasks()
      mainWindow.webContents.send('claudeTasks:change', tasks)
    } catch (err) {
      console.error('Failed to emit Claude tasks change:', err)
    }
  }

  claudeTasksWatcher.on('add', emitChange)
  claudeTasksWatcher.on('change', emitChange)
  claudeTasksWatcher.on('unlink', emitChange)

  claudeTasksWatcher.on('error', (error) => {
    console.error('Claude tasks watcher error:', error)
  })

  console.log('Claude tasks watcher started')
}

/**
 * Stop watching Claude tasks
 */
export function stopClaudeTasksWatcher() {
  if (claudeTasksWatcher) {
    claudeTasksWatcher.close()
    claudeTasksWatcher = null
    console.log('Claude tasks watcher stopped')
  }
}
