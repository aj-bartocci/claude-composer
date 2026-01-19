/**
 * IMPORTANT: Preload scripts MUST use CommonJS require() syntax, NOT ESM imports.
 * Electron preload scripts run in a special context that requires CommonJS.
 * ESM imports cause "Cannot use import statement outside a module" errors.
 *
 * See CLAUDE.md "Preload Script Must Use CommonJS" section for details.
 */
const { contextBridge, ipcRenderer } = require('electron')

const api = {
  chat: {
    getSessions: (projectPath?: string) =>
      ipcRenderer.invoke('chat:getSessions', projectPath),
    getMessages: (sessionId: string) =>
      ipcRenderer.invoke('chat:getMessages', sessionId),
    showSessionInFinder: (sessionId: string) =>
      ipcRenderer.invoke('chat:showSessionInFinder', sessionId),
    onSessionUpdate: (callback: (sessions: unknown[]) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, sessions: unknown[]) => callback(sessions)
      ipcRenderer.on('chat:sessionUpdate', handler)
      return () => ipcRenderer.removeListener('chat:sessionUpdate', handler)
    },
    onMessagesUpdate: (callback: (data: { sessionId: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { sessionId: string }) => callback(data)
      ipcRenderer.on('chat:messagesUpdate', handler)
      return () => ipcRenderer.removeListener('chat:messagesUpdate', handler)
    },
  },

  subagents: {
    getActive: () =>
      ipcRenderer.invoke('subagents:getActive'),
    getTodos: (sessionId: string) =>
      ipcRenderer.invoke('subagents:getTodos', sessionId),
    getAgentTodos: (sessionId: string, agentId: string) =>
      ipcRenderer.invoke('subagents:getAgentTodos', sessionId, agentId),
    onStatusChange: (callback: (subagent: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, subagent: unknown) => callback(subagent)
      ipcRenderer.on('subagents:statusChange', handler)
      return () => ipcRenderer.removeListener('subagents:statusChange', handler)
    },
  },

  files: {
    getTree: (rootPath: string) =>
      ipcRenderer.invoke('files:getTree', rootPath),
    getContent: (filePath: string) =>
      ipcRenderer.invoke('files:getContent', filePath),
    saveContent: (filePath: string, content: string) =>
      ipcRenderer.invoke('files:saveContent', filePath, content),
    showInFinder: (folderPath: string) =>
      ipcRenderer.invoke('files:showInFinder', folderPath),
    onFileChange: (callback: (event: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, fileEvent: unknown) => callback(fileEvent)
      ipcRenderer.on('files:change', handler)
      return () => ipcRenderer.removeListener('files:change', handler)
    },
  },

  app: {
    getTheme: () =>
      ipcRenderer.invoke('app:getTheme'),
    setTheme: (theme: 'light' | 'dark') =>
      ipcRenderer.invoke('app:setTheme', theme),
    getAppearanceSettings: () =>
      ipcRenderer.invoke('app:getAppearanceSettings'),
    setAppearanceSettings: (settings: { mode: string; customTheme: string | null }) =>
      ipcRenderer.invoke('app:setAppearanceSettings', settings),
    getCustomThemes: () =>
      ipcRenderer.invoke('app:getCustomThemes'),
    importTheme: (sourcePath: string) =>
      ipcRenderer.invoke('app:importTheme', sourcePath),
    openFolder: () =>
      ipcRenderer.invoke('app:openFolder'),
    openFile: (filters?: { name: string; extensions: string[] }[]) =>
      ipcRenderer.invoke('app:openFile', filters),
    openExternal: (url: string) =>
      ipcRenderer.invoke('app:openExternal', url),
  },

  projects: {
    getAll: () =>
      ipcRenderer.invoke('projects:getAll'),
    getLastProjectId: () =>
      ipcRenderer.invoke('projects:getLastProjectId'),
    setLastProjectId: (projectId: string | null) =>
      ipcRenderer.invoke('projects:setLastProjectId', projectId),
  },

  terminal: {
    spawn: (terminalId: string, options?: { cols?: number; rows?: number; cwd?: string }) =>
      ipcRenderer.invoke('terminal:spawn', terminalId, options),
    write: (terminalId: string, data: string) =>
      ipcRenderer.invoke('terminal:write', terminalId, data),
    resize: (terminalId: string, cols: number, rows: number) =>
      ipcRenderer.invoke('terminal:resize', terminalId, cols, rows),
    kill: (terminalId: string) =>
      ipcRenderer.invoke('terminal:kill', terminalId),
    onData: (callback: (data: { terminalId: string; data: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: { terminalId: string; data: string }) => callback(payload)
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    },
    onExit: (callback: (data: { terminalId: string; exitCode: number; signal?: number }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: { terminalId: string; exitCode: number; signal?: number }) => callback(payload)
      ipcRenderer.on('terminal:exit', handler)
      return () => ipcRenderer.removeListener('terminal:exit', handler)
    },
  },

  beans: {
    checkDirectory: (projectPath: string) =>
      ipcRenderer.invoke('beans:checkDirectory', projectPath),
    getBeans: (projectPath: string) =>
      ipcRenderer.invoke('beans:getBeans', projectPath),
    startWatcher: (projectPath: string) =>
      ipcRenderer.invoke('beans:startWatcher', projectPath),
    stopWatcher: (projectPath: string) =>
      ipcRenderer.invoke('beans:stopWatcher', projectPath),
    getVisibleColumns: (projectId: string) =>
      ipcRenderer.invoke('beans:getVisibleColumns', projectId),
    setVisibleColumns: (projectId: string, columns: string[]) =>
      ipcRenderer.invoke('beans:setVisibleColumns', projectId, columns),
    onBeansChange: (callback: (beans: unknown[]) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, beans: unknown[]) => callback(beans)
      ipcRenderer.on('beans:change', handler)
      return () => ipcRenderer.removeListener('beans:change', handler)
    },
  },
}

contextBridge.exposeInMainWorld('claude', api)
