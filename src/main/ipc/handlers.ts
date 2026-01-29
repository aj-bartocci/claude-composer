import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { getSessions, getMessages, getSessionPath } from './chat'
import { getActiveSubagents, getTodos, getAgentTodos } from './subagents'
import { getFileTree, getFileContent, saveFileContent } from './files'
import { getAllProjects, decodeProjectPath } from './projects'
import { spawnTerminal, writeToTerminal, resizeTerminal, killTerminal, type TerminalSpawnOptions } from './terminal'
import { checkBeansDirectory, getBeans } from './beans'
import { getAllTasks, getSessionTasks } from './claude-tasks'
import { startBeansWatcher, stopBeansWatcher, startClaudeTasksWatcher, stopClaudeTasksWatcher } from '../watchers/claude-watcher'
import { getCustomThemes, importTheme, ensureDefaultThemes } from './themes'
import Store from 'electron-store'
import type { Theme, AppearanceSettings } from '../../shared/types'

const store = new Store<{
  theme: Theme
  lastProjectId?: string
  beansVisibleColumns?: Record<string, string[]>
  appearanceSettings?: AppearanceSettings
}>({
  defaults: {
    theme: 'dark',
    appearanceSettings: { mode: 'system', customTheme: null }
  }
})

export function registerIpcHandlers(mainWindow: BrowserWindow) {
  // Chat handlers
  ipcMain.handle('chat:getSessions', async (_event, projectPath?: string) => {
    return getSessions(projectPath)
  })

  ipcMain.handle('chat:getMessages', async (_event, sessionId: string) => {
    return getMessages(sessionId)
  })

  ipcMain.handle('chat:showSessionInFinder', async (_event, sessionId: string) => {
    const path = await getSessionPath(sessionId)
    if (path) {
      shell.showItemInFolder(path)
    }
  })

  // Subagent handlers
  ipcMain.handle('subagents:getActive', async () => {
    return getActiveSubagents()
  })

  ipcMain.handle('subagents:getTodos', async (_event, sessionId: string) => {
    return getTodos(sessionId)
  })

  ipcMain.handle('subagents:getAgentTodos', async (_event, sessionId: string, agentId: string) => {
    return getAgentTodos(sessionId, agentId)
  })

  // File handlers
  ipcMain.handle('files:getTree', async (_event, rootPath: string) => {
    return getFileTree(rootPath)
  })

  ipcMain.handle('files:getContent', async (_event, filePath: string) => {
    return getFileContent(filePath)
  })

  ipcMain.handle('files:saveContent', async (_event, filePath: string, content: string) => {
    return saveFileContent(filePath, content)
  })

  ipcMain.handle('files:showInFinder', async (_event, folderPath: string) => {
    shell.showItemInFolder(folderPath)
  })

  // App handlers
  ipcMain.handle('app:getTheme', () => {
    return store.get('theme')
  })

  ipcMain.handle('app:setTheme', (_event, theme: Theme) => {
    store.set('theme', theme)
    mainWindow.webContents.send('app:themeChanged', theme)
  })

  ipcMain.handle('app:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle('app:openExternal', async (_event, url: string) => {
    await shell.openExternal(url)
  })

  ipcMain.handle('app:getAppearanceSettings', () => {
    return store.get('appearanceSettings') ?? { mode: 'system', customTheme: null }
  })

  ipcMain.handle('app:setAppearanceSettings', (_event, settings: AppearanceSettings) => {
    store.set('appearanceSettings', settings)
    mainWindow.webContents.send('app:appearanceChanged', settings)
  })

  ipcMain.handle('app:getCustomThemes', async () => {
    return getCustomThemes()
  })

  ipcMain.handle('app:importTheme', async (_event, sourcePath: string) => {
    return importTheme(sourcePath)
  })

  ipcMain.handle('app:openFile', async (_event, filters?: { name: string; extensions: string[] }[]) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters ?? [{ name: 'All Files', extensions: ['*'] }],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  // Ensure default themes exist
  ensureDefaultThemes().catch(console.error)

  // Project handlers
  ipcMain.handle('projects:getAll', async () => {
    return getAllProjects()
  })

  ipcMain.handle('projects:getLastProjectId', () => {
    const lastProjectId = store.get('lastProjectId')
    if (lastProjectId) {
      // Validate that the decoded path still exists
      const decodedPath = decodeProjectPath(lastProjectId)
      if (!existsSync(decodedPath)) {
        // Clear stale reference
        store.delete('lastProjectId')
        return undefined
      }
    }
    return lastProjectId
  })

  ipcMain.handle('projects:setLastProjectId', (_event, projectId: string | null) => {
    if (projectId) {
      store.set('lastProjectId', projectId)
    } else {
      store.delete('lastProjectId')
    }
  })

  // Terminal handlers
  ipcMain.handle('terminal:spawn', (_event, terminalId: string, options?: TerminalSpawnOptions) => {
    spawnTerminal(mainWindow, terminalId, options)
  })

  ipcMain.handle('terminal:write', (_event, terminalId: string, data: string) => {
    writeToTerminal(terminalId, data)
  })

  ipcMain.handle('terminal:resize', (_event, terminalId: string, cols: number, rows: number) => {
    resizeTerminal(terminalId, cols, rows)
  })

  ipcMain.handle('terminal:kill', (_event, terminalId: string) => {
    killTerminal(terminalId)
  })

  // Beans handlers
  ipcMain.handle('beans:checkDirectory', async (_event, projectPath: string) => {
    return checkBeansDirectory(projectPath)
  })

  ipcMain.handle('beans:getBeans', async (_event, projectPath: string) => {
    return getBeans(projectPath)
  })

  ipcMain.handle('beans:startWatcher', async (_event, projectPath: string) => {
    startBeansWatcher(mainWindow, projectPath)
  })

  ipcMain.handle('beans:stopWatcher', async (_event, projectPath: string) => {
    stopBeansWatcher(projectPath)
  })

  ipcMain.handle('beans:getVisibleColumns', (_event, projectId: string) => {
    const all = store.get('beansVisibleColumns') ?? {}
    return all[projectId] ?? null
  })

  ipcMain.handle('beans:setVisibleColumns', (_event, projectId: string, columns: string[]) => {
    const all = store.get('beansVisibleColumns') ?? {}
    all[projectId] = columns
    store.set('beansVisibleColumns', all)
  })

  // Claude Tasks handlers
  ipcMain.handle('claudeTasks:getAllTasks', async () => {
    return getAllTasks()
  })

  ipcMain.handle('claudeTasks:getSessionTasks', async (_event, sessionId: string) => {
    return getSessionTasks(sessionId)
  })

  ipcMain.handle('claudeTasks:startWatcher', async () => {
    startClaudeTasksWatcher(mainWindow)
  })

  ipcMain.handle('claudeTasks:stopWatcher', async () => {
    stopClaudeTasksWatcher()
  })
}

// Helper to emit events to renderer
export function emitToRenderer(mainWindow: BrowserWindow, channel: string, data: unknown) {
  mainWindow.webContents.send(channel, data)
}
