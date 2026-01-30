// Session represents a Claude Code conversation session
export interface Session {
  id: string
  projectPath: string
  startedAt: Date
  lastMessageAt: Date
  preview: string // First ~100 chars of the conversation
  messageCount: number
}

// Message in a session
export interface Message {
  messageId: string
  sessionId: string
  type: 'message' | 'tool_use' | 'tool_result'
  role: 'user' | 'assistant'
  content: MessageContent[]
  timestamp: Date
}

export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string }

// Subagent represents a spawned task agent
export interface Subagent {
  id: string
  sessionId: string
  status: 'running' | 'completed' | 'failed' | 'initializing'
  name: string // First todo's content - stable description of overall task
  description: string
  startedAt: Date
  completedAt?: Date
  // Progress tracking
  totalTasks: number
  completedTasks: number
  inProgressTask?: string // activeForm of current in-progress task
  cachedTodos?: Todo[] // Preserved todos for completed subagents
}

// Todo item from subagent task list
export interface Todo {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
}

// File tree node for markdown browser
export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

// File change event
export interface FileEvent {
  type: 'add' | 'change' | 'unlink'
  path: string
}

// Theme preference (kept for backward compatibility)
export type Theme = 'light' | 'dark'

// Color mode for appearance settings
export type ColorMode = 'light' | 'dark' | 'system'

// Custom theme colors (all optional, fall back to defaults)
export interface ThemeColors {
  background?: string
  foreground?: string
  muted?: string
  accent?: string
  border?: string
  sidebar?: string
  panel?: string
  itemBg?: string
  itemHover?: string
  itemSelected?: string
  codeBg?: string
  codeBorder?: string
  codeText?: string
}

// Theme file format - supports universal OR light/dark variants
export interface ThemeFile {
  name: string
  colors?: ThemeColors      // Universal theme (same for light/dark)
  light?: ThemeColors       // Light variant
  dark?: ThemeColors        // Dark variant
}

// Theme with metadata for UI
export interface CustomTheme {
  id: string                // filename without .json
  name: string
  file: ThemeFile
  bundled?: boolean         // true for built-in themes
}

// Appearance settings persisted to disk
export interface AppearanceSettings {
  mode: ColorMode
  customTheme: string | null  // theme id, null = default
}

// Bean (flat-file issue tracker) types
export type BeanStatus = 'draft' | 'todo' | 'in-progress' | 'completed' | 'scrapped'
export type BeanPriority = 'critical' | 'high' | 'normal' | 'low' | 'deferred'

export interface Bean {
  id: string
  title: string
  status: BeanStatus
  type?: string
  priority: BeanPriority
  tags: string[]
  body: string
  filePath: string
  updatedAt: number // mtime for sorting
}

// Project discovered from ~/.claude/projects/
export interface Project {
  id: string         // Directory name (encoded path)
  name: string       // Display name (last path segment)
  rootPath: string   // Full decoded path to code folder
  lastActivity: number // sessions-index.json mtime (ms since epoch)
}

// Claude native task (from ~/.claude/tasks/)
export interface ClaudeTask {
  id: string
  subject: string
  description: string
  activeForm?: string
  status: 'pending' | 'in_progress' | 'completed'
  blocks: string[]
  blockedBy: string[]
  sessionId: string // Which session this task belongs to
}

// Terminal session in sidebar
export interface TerminalSession {
  id: string           // Unique ID for PTY (e.g., "term-1705234567890-abc123")
  name: string         // User-editable display name ("Terminal 1")
  createdAt: number    // Timestamp for ordering
  exited: boolean      // PTY process has exited
  restartCount: number // Increment to force re-mount on restart
}

// Terminal spawn options
export interface TerminalSpawnOptions {
  cols?: number
  rows?: number
  cwd?: string
}

// Terminal data event
export interface TerminalDataEvent {
  terminalId: string
  data: string
}

// Terminal exit event
export interface TerminalExitEvent {
  terminalId: string
  exitCode: number
  signal?: number
}

// IPC API interface (matches what preload exposes)
export interface ClaudeAPI {
  chat: {
    getSessions: (projectPath?: string) => Promise<Session[]>
    getMessages: (sessionId: string) => Promise<Message[]>
    showSessionInFinder: (sessionId: string) => Promise<void>
    onSessionUpdate: (callback: (sessions: Session[]) => void) => () => void
    onMessagesUpdate: (callback: (data: { sessionId: string }) => void) => () => void
  }
  subagents: {
    getActive: () => Promise<Subagent[]>
    getTodos: (sessionId: string) => Promise<Todo[]>
    getAgentTodos: (sessionId: string, agentId: string) => Promise<Todo[]>
    onStatusChange: (callback: (subagent: Subagent) => void) => () => void
  }
  files: {
    getTree: (rootPath: string) => Promise<FileNode[]>
    getContent: (filePath: string) => Promise<string>
    saveContent: (filePath: string, content: string) => Promise<void>
    showInFinder: (folderPath: string) => Promise<void>
    onFileChange: (callback: (event: FileEvent) => void) => () => void
  }
  app: {
    getTheme: () => Promise<Theme>
    setTheme: (theme: Theme) => Promise<void>
    getAppearanceSettings: () => Promise<AppearanceSettings>
    setAppearanceSettings: (settings: AppearanceSettings) => Promise<void>
    getCustomThemes: () => Promise<CustomTheme[]>
    importTheme: (sourcePath: string) => Promise<CustomTheme>
    openFolder: () => Promise<string | null>
    openFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>
    openExternal: (url: string) => Promise<void>
  }
  projects: {
    getAll: () => Promise<Project[]>
    getLastProjectId: () => Promise<string | undefined>
    setLastProjectId: (projectId: string | null) => Promise<void>
  }
  terminal: {
    spawn: (terminalId: string, options?: TerminalSpawnOptions) => Promise<void>
    write: (terminalId: string, data: string) => Promise<void>
    resize: (terminalId: string, cols: number, rows: number) => Promise<void>
    kill: (terminalId: string) => Promise<void>
    onData: (callback: (event: TerminalDataEvent) => void) => () => void
    onExit: (callback: (event: TerminalExitEvent) => void) => () => void
  }
  beans: {
    checkDirectory: (projectPath: string) => Promise<boolean>
    getBeans: (projectPath: string) => Promise<Bean[]>
    startWatcher: (projectPath: string) => Promise<void>
    stopWatcher: (projectPath: string) => Promise<void>
    getVisibleColumns: (projectId: string) => Promise<string[] | null>
    setVisibleColumns: (projectId: string, columns: string[]) => Promise<void>
    onBeansChange: (callback: (beans: Bean[]) => void) => () => void
  }
  claudeTasks: {
    getAllTasks: () => Promise<ClaudeTask[]>
    getSessionTasks: (sessionId: string) => Promise<ClaudeTask[]>
    startWatcher: () => Promise<void>
    stopWatcher: () => Promise<void>
    onTasksChange: (callback: (tasks: ClaudeTask[]) => void) => () => void
    getHiddenSessions: () => Promise<string[]>
    setHiddenSessions: (sessionIds: string[]) => Promise<void>
  }
}
