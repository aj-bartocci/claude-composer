import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle, usePanelRef, type PanelImperativeHandle } from 'react-resizable-panels'
import ReactMarkdown from 'react-markdown'
import type { Session, Message, Subagent, Theme, Project, ClaudeAPI, TerminalSession, Bean } from '../shared/types'
import { SubagentCard } from './components/SubagentCard'
import { Terminal } from './components/Terminal'
import { TerminalListItem } from './components/TerminalListItem'
import { ConfirmModal } from './components/ConfirmModal'
import { BeansBoard } from './components/BeansBoard'
import { useTheme } from './hooks/useTheme'
import { SettingsModal } from './components/SettingsModal'

// Mock API for browser development
const mockApi: ClaudeAPI = {
  chat: {
    getSessions: async () => [
      { id: '1', projectPath: '/test', startedAt: new Date(), lastMessageAt: new Date(), preview: 'Mock session for browser dev', messageCount: 2 },
      { id: '2', projectPath: '/test', startedAt: new Date(Date.now() - 86400000), lastMessageAt: new Date(Date.now() - 86400000), preview: 'Yesterday session', messageCount: 5 },
    ],
    getMessages: async () => [
      { messageId: 'm1', sessionId: '1', type: 'message', role: 'user', content: [{ type: 'text', text: 'Find all TypeScript files in the project' }], timestamp: new Date() },
      { messageId: 'm2', sessionId: '1', type: 'message', role: 'assistant', content: [
        { type: 'text', text: "I'll search for TypeScript files in the project." },
        { type: 'tool_use', id: 't1', name: 'Glob', input: { pattern: '**/*.ts' } },
      ], timestamp: new Date() },
      { messageId: 'm3', sessionId: '1', type: 'message', role: 'user', content: [
        { type: 'tool_result', tool_use_id: 't1', content: 'Found 12 files\nsrc/main.ts\nsrc/renderer/App.tsx\nsrc/preload/index.ts\nsrc/shared/types.ts' },
      ], timestamp: new Date() },
      { messageId: 'm4', sessionId: '1', type: 'message', role: 'assistant', content: [
        { type: 'text', text: 'I found 12 TypeScript files. Let me read the main entry point.' },
        { type: 'tool_use', id: 't2', name: 'Read', input: { path: 'src/main.ts' } },
      ], timestamp: new Date() },
      { messageId: 'm5', sessionId: '1', type: 'message', role: 'user', content: [
        { type: 'tool_result', tool_use_id: 't2', content: 'import { app, BrowserWindow } from "electron"\nimport path from "path"\n\nfunction createWindow() {\n  const win = new BrowserWindow({\n    width: 1200,\n    height: 800,\n  })\n  win.loadFile("index.html")\n}' },
      ], timestamp: new Date() },
      { messageId: 'm6', sessionId: '1', type: 'message', role: 'assistant', content: [
        { type: 'text', text: 'This is the main Electron process file. It creates a browser window with dimensions 1200x800.' },
      ], timestamp: new Date() },
    ],
    showSessionInFinder: async () => {},
    onSessionUpdate: () => () => {},
    onMessagesUpdate: () => () => {},
  },
  subagents: {
    getActive: async () => [
      {
        id: 'mock-agent-1',
        sessionId: '1',
        status: 'running' as const,
        name: 'Implement user authentication',
        description: 'Adding login form validation',
        startedAt: new Date(),
        totalTasks: 5,
        completedTasks: 2,
        inProgressTask: 'Adding login form validation',
      },
      {
        id: 'mock-agent-2',
        sessionId: '1',
        status: 'completed' as const,
        name: 'Fix database connection',
        description: 'Fix database connection',
        startedAt: new Date(Date.now() - 3600000),
        completedAt: new Date(),
        totalTasks: 3,
        completedTasks: 3,
      },
    ],
    getTodos: async () => [],
    getAgentTodos: async () => [
      { id: '1', content: 'Set up auth middleware', status: 'completed' as const },
      { id: '2', content: 'Create login endpoint', status: 'completed' as const },
      { id: '3', content: 'Add login form validation', status: 'in_progress' as const },
      { id: '4', content: 'Implement session storage', status: 'pending' as const },
      { id: '5', content: 'Add logout functionality', status: 'pending' as const },
    ],
    onStatusChange: () => () => {},
  },
  files: {
    getTree: async () => [
      { name: 'docs', path: '/mock/docs', type: 'directory' as const, children: [
        { name: 'README.md', path: '/mock/docs/README.md', type: 'file' as const },
        { name: 'GUIDE.md', path: '/mock/docs/GUIDE.md', type: 'file' as const },
      ]},
      { name: 'CLAUDE.md', path: '/mock/CLAUDE.md', type: 'file' as const },
    ],
    getContent: async (path: string) => `# ${path.split('/').pop()}\n\nThis is mock content for **${path}**.\n\n- Item 1\n- Item 2\n- Item 3`,
    saveContent: async () => {},
    showInFinder: async () => {},
    onFileChange: () => () => {},
  },
  app: {
    getTheme: async () => 'dark' as const,
    setTheme: async () => {},
    getAppearanceSettings: async () => ({ mode: 'system' as const, customTheme: null }),
    setAppearanceSettings: async () => {},
    getCustomThemes: async () => [],
    importTheme: async () => ({ id: 'mock', name: 'Mock Theme', file: { name: 'Mock Theme' } }),
    openFolder: async () => '/mock/project',
    openFile: async () => '/mock/file.json',
    openExternal: async (url: string) => { window.open(url, '_blank') },
  },
  projects: {
    getAll: async () => [
      { id: '-mock-project-1', name: 'mock-project-1', rootPath: '/mock/project-1', lastActivity: Date.now() },
      { id: '-mock-project-2', name: 'mock-project-2', rootPath: '/mock/project-2', lastActivity: Date.now() - 86400000 },
    ],
    getLastProjectId: async () => undefined,
    setLastProjectId: async () => {},
  },
  terminal: {
    spawn: async () => {},
    write: async () => {},
    resize: async () => {},
    kill: async () => {},
    onData: () => () => {},
    onExit: () => () => {},
  },
  beans: {
    checkDirectory: async () => true,
    getBeans: async () => [
      { id: 'bean-1', title: 'Implement user auth', status: 'todo' as const, priority: 'high' as const, tags: ['auth', 'security'], type: 'feature', body: '# User Authentication\n\nImplement login/logout flow.', filePath: '.beans/bean-1.md', updatedAt: Date.now() },
      { id: 'bean-2', title: 'Fix database connection', status: 'in-progress' as const, priority: 'critical' as const, tags: ['bug'], type: 'bug', body: 'Database times out after 30s.', filePath: '.beans/bean-2.md', updatedAt: Date.now() - 3600000 },
      { id: 'bean-3', title: 'Add dark mode', status: 'completed' as const, priority: 'normal' as const, tags: ['ui'], type: 'feature', body: 'Support system theme preference.', filePath: '.beans/bean-3.md', updatedAt: Date.now() - 86400000 },
      { id: 'bean-4', title: 'API documentation', status: 'draft' as const, priority: 'low' as const, tags: ['docs'], type: 'task', body: 'Write OpenAPI spec.', filePath: '.beans/bean-4.md', updatedAt: Date.now() - 172800000 },
    ],
    startWatcher: async () => {},
    stopWatcher: async () => {},
    getVisibleColumns: async () => null,
    setVisibleColumns: async () => {},
    onBeansChange: () => () => {},
  },
}

// Get API - check dynamically each time to handle race conditions during startup
function getApi(): ClaudeAPI {
  if (typeof window !== 'undefined' && 'claude' in window) {
    return window.claude
  }
  return mockApi
}

function App() {
  // Check for Electron API dynamically - handles race condition where preload may not be ready on first render
  const [isElectron, setIsElectron] = useState(() => typeof window !== 'undefined' && 'claude' in window)
  const api = useMemo(() => getApi(), [isElectron])

  const [settingsOpen, setSettingsOpen] = useState(false)
  const themeState = useTheme(api)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [subagents, setSubagents] = useState<Subagent[]>([])
  const [stickySubagents, setStickySubagents] = useState<Subagent[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [showRemoveAllModal, setShowRemoveAllModal] = useState(false)
  const todoCache = useRef<Map<string, import('../shared/types').Todo[]>>(new Map())
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  // File browser state
  const [fileTree, setFileTree] = useState<import('../shared/types').FileNode[]>([])
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [unsavedChanges, setUnsavedChanges] = useState<Map<string, string>>(new Map())

  // Beans board state
  const [hasBeansDir, setHasBeansDir] = useState(false)
  const [beans, setBeans] = useState<Bean[]>([])
  const [viewMode, setViewMode] = useState<'files' | 'board'>('files')
  const filePathRestoredForProject = useRef<string | null>(null)
  const [markdownViewMode, setMarkdownViewMode] = useState<'rendered' | 'raw'>('rendered')
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Sidebar collapse state (persisted to localStorage)
  const [sessionsExpanded, setSessionsExpanded] = useState(() => {
    const stored = localStorage.getItem('claude-center-sections-expanded')
    if (stored) {
      try { return JSON.parse(stored).sessions ?? true } catch { return true }
    }
    return true
  })
  const [subagentsExpanded, setSubagentsExpanded] = useState(() => {
    const stored = localStorage.getItem('claude-center-sections-expanded')
    if (stored) {
      try { return JSON.parse(stored).subagents ?? true } catch { return true }
    }
    return true
  })
  const [filesExpanded, setFilesExpanded] = useState(() => {
    const stored = localStorage.getItem('claude-center-sections-expanded')
    if (stored) {
      try { return JSON.parse(stored).files ?? true } catch { return true }
    }
    return true
  })

  // Multi-terminal state - keyed by project ID for per-project persistence
  const [terminalsByProject, setTerminalsByProject] = useState<Map<string, TerminalSession[]>>(new Map())
  const [activeTerminalByProject, setActiveTerminalByProject] = useState<Map<string, string | null>>(new Map())
  const [terminalsExpanded, setTerminalsExpanded] = useState(() => {
    const stored = localStorage.getItem('claude-center-sections-expanded')
    if (stored) {
      try { return JSON.parse(stored).terminals ?? true } catch { return true }
    }
    return true
  })
  const [editingTerminalId, setEditingTerminalId] = useState<string | null>(null)

  // Derive current project's terminals
  const currentTerminals = selectedProject
    ? (terminalsByProject.get(selectedProject.id) ?? [])
    : []
  const activeTerminalId = selectedProject
    ? (activeTerminalByProject.get(selectedProject.id) ?? null)
    : null

  // Check if any terminals exist across all projects (for panel visibility)
  const hasAnyTerminals = Array.from(terminalsByProject.values()).some(sessions => sessions.length > 0)

  // Terminal helper functions
  const generateTerminalId = useCallback(() => {
    return `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }, [])

  const generateTerminalName = useCallback((sessions: TerminalSession[]) => {
    const existingNumbers = sessions.map(s => {
      const match = s.name.match(/^Terminal (\d+)$/)
      return match ? parseInt(match[1], 10) : 0
    })
    let num = 1
    while (existingNumbers.includes(num)) num++
    return `Terminal ${num}`
  }, [])

  const addTerminal = useCallback((projectId: string) => {
    const id = generateTerminalId()
    const projectTerminals = terminalsByProject.get(projectId) ?? []
    const newSession: TerminalSession = {
      id,
      name: generateTerminalName(projectTerminals),
      createdAt: Date.now(),
      exited: false,
      restartCount: 0,
    }
    setTerminalsByProject(prev => {
      const next = new Map(prev)
      next.set(projectId, [...(prev.get(projectId) ?? []), newSession])
      return next
    })
    setActiveTerminalByProject(prev => new Map(prev).set(projectId, id))
  }, [generateTerminalId, generateTerminalName, terminalsByProject])

  const removeTerminal = useCallback((projectId: string, terminalId: string) => {
    // Kill the PTY
    api.terminal.kill(terminalId).catch(() => {})

    setTerminalsByProject(prev => {
      const next = new Map(prev)
      const filtered = (prev.get(projectId) ?? []).filter(s => s.id !== terminalId)
      next.set(projectId, filtered)
      return next
    })

    // Update active terminal if we removed the active one
    setActiveTerminalByProject(prev => {
      const currentActive = prev.get(projectId)
      if (currentActive === terminalId) {
        const remaining = (terminalsByProject.get(projectId) ?? []).filter(s => s.id !== terminalId)
        return new Map(prev).set(projectId, remaining.length > 0 ? remaining[remaining.length - 1].id : null)
      }
      return prev
    })
  }, [api, terminalsByProject])

  const renameTerminal = useCallback((projectId: string, terminalId: string, name: string) => {
    setTerminalsByProject(prev => {
      const next = new Map(prev)
      const sessions = prev.get(projectId) ?? []
      next.set(projectId, sessions.map(s => s.id === terminalId ? { ...s, name } : s))
      return next
    })
    setEditingTerminalId(null)
  }, [])

  const markTerminalExited = useCallback((projectId: string, terminalId: string) => {
    setTerminalsByProject(prev => {
      const next = new Map(prev)
      const sessions = prev.get(projectId) ?? []
      next.set(projectId, sessions.map(s => s.id === terminalId ? { ...s, exited: true } : s))
      return next
    })
  }, [])

  const restartTerminal = useCallback((projectId: string, terminalId: string) => {
    setTerminalsByProject(prev => {
      const next = new Map(prev)
      const sessions = prev.get(projectId) ?? []
      next.set(projectId, sessions.map(s => s.id === terminalId ? { ...s, exited: false, restartCount: s.restartCount + 1 } : s))
      return next
    })
  }, [])

  // Panel layout persistence with refs for imperative resizing
  const sidebarRef = usePanelRef()
  const detailRef = usePanelRef()
  const showDetailPanel = selectedSessionId !== null

  // Apply saved sizes when PanelGroup mounts/remounts (key changes)
  useEffect(() => {
    // Small delay to ensure refs are attached after mount
    const timer = setTimeout(() => {
      const savedSidebar = localStorage.getItem('claude-center-sidebar-size')
      if (savedSidebar && sidebarRef.current) {
        sidebarRef.current.resize(`${savedSidebar}%`)
      }
      const savedDetail = localStorage.getItem('claude-center-detail-size')
      if (savedDetail && detailRef.current) {
        detailRef.current.resize(`${savedDetail}%`)
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [showDetailPanel]) // Re-run when panel config changes

  // Persist sidebar section expand/collapse state
  useEffect(() => {
    localStorage.setItem('claude-center-sections-expanded', JSON.stringify({
      sessions: sessionsExpanded,
      subagents: subagentsExpanded,
      files: filesExpanded,
      terminals: terminalsExpanded,
    }))
  }, [sessionsExpanded, subagentsExpanded, filesExpanded, terminalsExpanded])

  // Sessions pagination
  const SESSIONS_BATCH_SIZE = 10
  const [visibleSessionsCount, setVisibleSessionsCount] = useState(SESSIONS_BATCH_SIZE)
  const visibleSessions = sessions.slice(0, visibleSessionsCount)
  const hasMoreSessions = visibleSessionsCount < sessions.length

  // Re-check for Electron API after mount (handles race condition during dev startup)
  // Poll briefly because preload script may not have finished exposing window.claude
  useEffect(() => {
    if (isElectron) return // Already detected

    let attempts = 0
    const maxAttempts = 20 // 2 seconds max
    const interval = setInterval(() => {
      attempts++
      if (typeof window !== 'undefined' && 'claude' in window) {
        console.log('[App] Electron API became available after', attempts * 100, 'ms')
        setIsElectron(true)
        // Reset state to trigger fresh data load with real API
        setProjects([])
        setSelectedProject(null)
        setSessions([])
        setSelectedSessionId(null)
        clearInterval(interval)
      } else if (attempts >= maxAttempts) {
        console.log('[App] Electron API not found after 2s, staying in mock mode')
        clearInterval(interval)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [isElectron])


  // Load projects and restore last selected or auto-select most recent
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const [allProjects, lastProjectId] = await Promise.all([
          api.projects.getAll(),
          api.projects.getLastProjectId()
        ])
        setProjects(allProjects)

        if (allProjects.length > 0) {
          // Try to restore last selected project, fallback to most recent
          const lastProject = lastProjectId
            ? allProjects.find(p => p.id === lastProjectId)
            : undefined
          setSelectedProject(lastProject ?? allProjects[0])
        }
      } catch (err) {
        console.error('Failed to load projects:', err)
      }
    }
    loadProjects()
  }, [])

  // Persist selected project ID
  useEffect(() => {
    if (selectedProject) {
      api.projects.setLastProjectId(selectedProject.id)
    }
  }, [selectedProject])

  // Clean up terminals for projects that no longer exist
  useEffect(() => {
    const projectIds = new Set(projects.map(p => p.id))

    terminalsByProject.forEach((sessions, projectId) => {
      if (!projectIds.has(projectId) && projectIds.size > 0) {
        // Kill all PTYs for removed project
        sessions.forEach(s => api.terminal.kill(s.id).catch(() => {}))
        // Remove from state
        setTerminalsByProject(prev => {
          const next = new Map(prev)
          next.delete(projectId)
          return next
        })
        setActiveTerminalByProject(prev => {
          const next = new Map(prev)
          next.delete(projectId)
          return next
        })
      }
    })
  }, [projects, terminalsByProject, api])


  // Load dismissed subagent IDs and persisted sticky subagents for selected project
  useEffect(() => {
    if (!selectedProject) {
      setDismissedIds(new Set())
      setStickySubagents([])
      return
    }
    // Load dismissed IDs
    const storedDismissed = localStorage.getItem(`dismissedSubagentIds-${selectedProject.id}`)
    setDismissedIds(storedDismissed ? new Set(JSON.parse(storedDismissed)) : new Set())

    // Load persisted sticky subagents (completed agents that should persist until dismissed)
    const storedSticky = localStorage.getItem(`stickySubagents-${selectedProject.id}`)
    if (storedSticky) {
      try {
        const parsed = JSON.parse(storedSticky)
        // Restore Date objects
        const restored = parsed.map((s: Subagent) => ({
          ...s,
          startedAt: new Date(s.startedAt),
          completedAt: s.completedAt ? new Date(s.completedAt) : undefined,
        }))
        setStickySubagents(restored)
      } catch {
        setStickySubagents([])
      }
    } else {
      setStickySubagents([])
    }
  }, [selectedProject])

  // Persist sticky subagents when they change (excluding dismissed ones)
  useEffect(() => {
    if (!selectedProject) return
    // Only persist non-running, non-dismissed subagents
    const toPersist = stickySubagents.filter(s => s.status !== 'running' && !dismissedIds.has(s.id))
    if (toPersist.length > 0) {
      localStorage.setItem(`stickySubagents-${selectedProject.id}`, JSON.stringify(toPersist))
    } else {
      localStorage.removeItem(`stickySubagents-${selectedProject.id}`)
    }
  }, [stickySubagents, dismissedIds, selectedProject])

  // Load sessions for selected project
  useEffect(() => {
    if (!selectedProject) {
      setSessions([])
      setLoading(false)
      return
    }

    const loadSessions = async () => {
      setLoading(true)
      try {
        const projectSessions = await api.chat.getSessions(selectedProject.id)
        setSessions(projectSessions)
        if (projectSessions.length > 0 && !selectedSessionId) {
          setSelectedSessionId(projectSessions[0].id)
        }
      } catch (err) {
        console.error('Failed to load sessions:', err)
      } finally {
        setLoading(false)
      }
    }
    loadSessions()

    // Subscribe to session updates - re-fetch from API to use correct filtering
    const unsubscribe = api.chat.onSessionUpdate(async () => {
      try {
        const projectSessions = await api.chat.getSessions(selectedProject.id)
        setSessions(projectSessions)
      } catch (err) {
        console.error('Failed to refresh sessions:', err)
      }
    })
    return unsubscribe
  }, [api, selectedProject])

  // Load messages when session selected
  useEffect(() => {
    if (!selectedSessionId) {
      setMessages([])
      return
    }
    const loadMessages = async () => {
      try {
        const sessionMessages = await api.chat.getMessages(selectedSessionId)
        setMessages(sessionMessages)
      } catch (err) {
        console.error('Failed to load messages:', err)
      }
    }
    loadMessages()

    // Subscribe to message updates for this session
    const unsubscribe = api.chat.onMessagesUpdate(({ sessionId }) => {
      if (sessionId === selectedSessionId) {
        loadMessages()
      }
    })
    return unsubscribe
  }, [api, selectedSessionId])

  // Track if user is near bottom of messages (for smart auto-scroll)
  const wasNearBottomRef = useRef(true)
  const prevMessagesLengthRef = useRef(0)

  // Update near-bottom state on scroll
  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const threshold = 100 // pixels from bottom
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold
    wasNearBottomRef.current = isNearBottom
  }, [])

  // Scroll to bottom when messages change, but only if user was near bottom or it's a new session
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container || messages.length === 0) return

    const isNewSession = prevMessagesLengthRef.current === 0
    const shouldScroll = isNewSession || wasNearBottomRef.current

    if (shouldScroll) {
      container.scrollTop = container.scrollHeight
    }

    prevMessagesLengthRef.current = messages.length
  }, [messages])

  // Reset scroll state when session changes
  useEffect(() => {
    wasNearBottomRef.current = true
    prevMessagesLengthRef.current = 0
  }, [selectedSessionId])

  // Load subagents for selected project's sessions
  useEffect(() => {
    const loadSubagents = async () => {
      if (!selectedProject || sessions.length === 0) {
        setSubagents([])
        return
      }
      try {
        const activeSubagents = await api.subagents.getActive()
        // Filter to subagents belonging to this project's sessions
        const sessionIds = new Set(sessions.map(s => s.id))
        const filtered = activeSubagents.filter(a => sessionIds.has(a.sessionId))

        // Fetch and cache todos for RUNNING/INITIALIZING subagents (continuous updates)
        const runningAgents = filtered.filter(s => s.status === 'running' || s.status === 'initializing')
        await Promise.all(runningAgents.map(async (agent) => {
          try {
            const todos = await api.subagents.getAgentTodos(agent.sessionId, agent.id)
            todoCache.current.set(agent.id, todos)
          } catch (err) {
            console.error('Failed to cache todos:', agent.id, err)
          }
        }))

        // Attach cached todos to all subagents
        const withCachedTodos = filtered.map(s => ({
          ...s,
          cachedTodos: todoCache.current.get(s.id)
        }))

        setSubagents(prev => {
          // Detect subagents that were running but are now gone (file deleted on completion)
          const newIds = new Set(withCachedTodos.map(s => s.id))
          const disappeared = prev.filter(s =>
            (s.status === 'running' || s.status === 'initializing') &&
            !newIds.has(s.id) &&
            sessionIds.has(s.sessionId)
          )

          // Mark disappeared running subagents as completed and add to sticky
          if (disappeared.length > 0) {
            setStickySubagents(sticky => {
              const merged = new Map(sticky.map(s => [s.id, s]))
              for (const agent of disappeared) {
                // Mark as completed with all tasks done
                merged.set(agent.id, {
                  ...agent,
                  status: 'completed' as const,
                  completedTasks: agent.totalTasks,
                  completedAt: new Date(),
                  cachedTodos: agent.cachedTodos?.map(t => ({ ...t, status: 'completed' as const }))
                })
              }
              return Array.from(merged.values())
            })
          }

          return withCachedTodos
        })

        // Update sticky subagents - only merge within same project's sessions
        setStickySubagents(prev => {
          const newSticky = withCachedTodos.filter(s => s.status !== 'running' && s.status !== 'initializing')
          // Only keep previous sticky subagents that belong to current project's sessions
          const validPrev = prev.filter(s => sessionIds.has(s.sessionId))
          const merged = new Map(validPrev.map(s => [s.id, s]))
          newSticky.forEach(s => merged.set(s.id, s))
          return Array.from(merged.values())
        })
      } catch (err) {
        console.error('Failed to load subagents:', err)
      }
    }
    loadSubagents()

    const unsubscribe = api.subagents.onStatusChange(() => {
      loadSubagents()
    })
    return unsubscribe
  }, [api, selectedProject, sessions])

  // Compute display list: running/initializing subagents + sticky (non-dismissed)
  const displaySubagents = useMemo(() => {
    const running = subagents.filter(s => s.status === 'running' || s.status === 'initializing')
    const sticky = stickySubagents.filter(s =>
      s.status !== 'running' && s.status !== 'initializing' && !dismissedIds.has(s.id)
    )
    // Dedupe by ID (running takes precedence)
    const seen = new Set(running.map(s => s.id))
    const unique = [...running, ...sticky.filter(s => !seen.has(s.id))]
    return unique
  }, [subagents, stickySubagents, dismissedIds])

  // Get content to display - prefer unsaved version if exists
  const displayContent = useMemo(() => {
    if (!selectedFilePath) return null
    return unsavedChanges.get(selectedFilePath) ?? fileContent
  }, [selectedFilePath, unsavedChanges, fileContent])

  // Check if current file has unsaved changes
  const currentFileIsDirty = selectedFilePath ? unsavedChanges.has(selectedFilePath) : false

  // Set of dirty paths for file tree indicator
  const dirtyPaths = useMemo(() => new Set(unsavedChanges.keys()), [unsavedChanges])

  // Save current file with Cmd+S / Ctrl+S
  const handleSave = useCallback(async () => {
    if (!selectedFilePath || !unsavedChanges.has(selectedFilePath)) return

    const content = unsavedChanges.get(selectedFilePath)!
    try {
      await api.files.saveContent(selectedFilePath, content)
      // Update fileContent to match saved content
      setFileContent(content)
      // Remove from unsaved changes
      setUnsavedChanges(prev => {
        const next = new Map(prev)
        next.delete(selectedFilePath)
        return next
      })
    } catch (err) {
      console.error('Failed to save file:', err)
    }
  }, [selectedFilePath, unsavedChanges, api])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  const handleDismissSubagent = useCallback((id: string) => {
    setDismissedIds(prev => {
      const next = new Set([...prev, id])
      if (selectedProject) {
        localStorage.setItem(`dismissedSubagentIds-${selectedProject.id}`, JSON.stringify([...next]))
      }
      return next
    })
  }, [selectedProject])

  const handleRemoveAllTasks = useCallback(() => {
    const allIds = displaySubagents.map(s => s.id)
    setDismissedIds(prev => {
      const next = new Set([...prev, ...allIds])
      if (selectedProject) {
        localStorage.setItem(`dismissedSubagentIds-${selectedProject.id}`, JSON.stringify([...next]))
      }
      return next
    })
    setShowRemoveAllModal(false)
  }, [displaySubagents, selectedProject])

  // Load file tree from selected project's folder
  useEffect(() => {
    if (!selectedProject) {
      setFileTree([])
      return
    }
    const loadTree = async () => {
      try {
        const tree = await api.files.getTree(selectedProject.rootPath)
        setFileTree(tree)

        // Restore persisted file or select first markdown
        const persistedPath = localStorage.getItem(`selectedFile-${selectedProject.id}`)
        if (persistedPath && pathExistsInTree(tree, persistedPath)) {
          setSelectedFilePath(persistedPath)
        } else {
          const firstMarkdown = findFirstMarkdownFile(tree)
          if (firstMarkdown) {
            setSelectedFilePath(firstMarkdown)
          }
        }
        // Mark restoration complete so persist effect can safely write
        filePathRestoredForProject.current = selectedProject.id
      } catch (err) {
        console.error('Failed to load file tree:', err)
      }
    }
    loadTree()
  }, [selectedProject])

  // Persist selected file per-project
  // Only persist after restoration is complete to avoid clearing stored value during project switch
  useEffect(() => {
    if (!selectedProject) return
    if (filePathRestoredForProject.current !== selectedProject.id) return
    if (selectedFilePath) {
      localStorage.setItem(`selectedFile-${selectedProject.id}`, selectedFilePath)
    } else {
      localStorage.removeItem(`selectedFile-${selectedProject.id}`)
    }
  }, [selectedFilePath, selectedProject])

  // Load file content when file selected
  useEffect(() => {
    if (!selectedFilePath) {
      setFileContent(null)
      return
    }
    const loadContent = async () => {
      try {
        const content = await api.files.getContent(selectedFilePath)
        setFileContent(content)
      } catch (err) {
        console.error('Failed to load file:', err)
        setFileContent(null)
      }
    }
    loadContent()
  }, [selectedFilePath])

  // Check for .beans directory and load beans when project changes
  useEffect(() => {
    if (!selectedProject) {
      setHasBeansDir(false)
      setBeans([])
      setViewMode('files')
      return
    }

    let cancelled = false

    const checkAndLoadBeans = async () => {
      try {
        const hasDir = await api.beans.checkDirectory(selectedProject.rootPath)
        if (cancelled) return

        setHasBeansDir(hasDir)
        if (hasDir) {
          const loadedBeans = await api.beans.getBeans(selectedProject.rootPath)
          if (cancelled) return
          setBeans(loadedBeans)
          // Start watcher
          await api.beans.startWatcher(selectedProject.rootPath)
        } else {
          setBeans([])
          setViewMode('files')
        }
      } catch (err) {
        console.error('Failed to check/load beans:', err)
        setHasBeansDir(false)
        setBeans([])
      }
    }

    checkAndLoadBeans()

    // Subscribe to beans changes
    const unsubscribe = api.beans.onBeansChange((updatedBeans) => {
      if (!cancelled) {
        setBeans(updatedBeans as Bean[])
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
      // Stop watcher on project switch
      api.beans.stopWatcher(selectedProject.rootPath).catch(() => {})
    }
  }, [api, selectedProject])

  const formatDate = (date: Date) => {
    const d = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Title bar */}
      <header className="h-12 flex items-center justify-between px-4 bg-sidebar border-b border-border titlebar-drag">
        <div className="w-20" />
        <h1 className="text-sm font-medium flex items-center gap-2">
          Claude Composer
          {!isElectron && <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-500">MOCK</span>}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="titlebar-no-drag p-2 rounded text-muted hover:text-foreground hover:bg-item-hover transition-colors"
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </header>

      <PanelGroup
        key={hasAnyTerminals ? 'with-terminal' : 'without-terminal'}
        orientation="vertical"
        className="flex-1"
      >
        <Panel id="main-area" minSize="20%">
          <PanelGroup
            key={showDetailPanel ? 'with-detail' : 'without-detail'}
            orientation="horizontal"
            className="h-full"
          >
        {/* Sidebar */}
        <Panel
          id="sidebar"
          panelRef={sidebarRef}
          defaultSize="20%"
          minSize="5%"
          maxSize="50%"
          onResize={(size) => {
            localStorage.setItem('claude-center-sidebar-size', String(size.asPercentage))
          }}
        >
        <aside className="h-full bg-sidebar border-r border-border flex flex-col overflow-hidden">
          {/* Project section */}
          <section className="p-3 border-b border-border">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
              Project
            </h2>
            <select
              value={selectedProject?.id ?? ''}
              onChange={(e) => {
                const project = projects.find(p => p.id === e.target.value)
                if (project) {
                  setSelectedProject(project)
                  setSelectedSessionId(null)
                  setSelectedFilePath(null)
                  setSessions([]) // Clear to prevent stale session filtering
                  setVisibleSessionsCount(SESSIONS_BATCH_SIZE) // Reset pagination
                  // Note: stickySubagents are loaded from localStorage in useEffect
                }
              }}
              className="w-full p-2 text-sm rounded bg-item-bg border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {projects.length === 0 ? (
                <option value="" disabled>No projects found</option>
              ) : (
                projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))
              )}
            </select>
            {/* Board button - shown when .beans directory exists */}
            {hasBeansDir && (
              <button
                onClick={() => setViewMode(viewMode === 'board' ? 'files' : 'board')}
                className={`mt-2 w-full p-2 text-sm rounded transition-colors ${
                  viewMode === 'board'
                    ? 'bg-accent text-white'
                    : 'bg-item-bg hover:bg-item-hover text-foreground'
                }`}
              >
                {viewMode === 'board' ? 'Back to Files' : 'Board'}
              </button>
            )}
          </section>

          {/* Sessions section */}
          <CollapsibleSection
            title="Sessions"
            expanded={sessionsExpanded}
            onToggle={() => setSessionsExpanded(!sessionsExpanded)}
            className={`px-3 overflow-y-auto ${sessionsExpanded ? 'flex-1' : ''}`}
          >
            {loading ? (
              <div className="text-sm text-muted">Loading...</div>
            ) : sessions.length === 0 ? (
              <div className="text-sm text-muted">No sessions found</div>
            ) : (
              <div className="space-y-1">
                {visibleSessions.map(session => (
                  <div
                    key={session.id}
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      session.id === selectedSessionId
                        ? 'bg-item-selected'
                        : 'bg-item-bg hover:bg-item-hover'
                    }`}
                  >
                    <div className="text-xs text-muted">{formatDate(session.lastMessageAt)}</div>
                    <div className="text-sm truncate">{session.preview || 'Empty session'}</div>
                  </div>
                ))}
                {hasMoreSessions && (
                  <button
                    onClick={() => setVisibleSessionsCount(prev => prev + SESSIONS_BATCH_SIZE)}
                    className="w-full mt-2 p-2 text-sm text-muted hover:text-foreground bg-item-bg hover:bg-item-hover rounded transition-colors"
                  >
                    Load More
                  </button>
                )}
              </div>
            )}
          </CollapsibleSection>

          {/* Tasks section */}
          <CollapsibleSection
            title="Tasks"
            expanded={subagentsExpanded}
            onToggle={() => setSubagentsExpanded(!subagentsExpanded)}
            className={`border-t border-border px-3 overflow-y-auto ${subagentsExpanded ? 'flex-1' : ''}`}
            headerAction={displaySubagents.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowRemoveAllModal(true)
                }}
                className="text-muted hover:text-red-500 text-xs px-1 transition-colors"
                title="Remove all tasks"
              >
                Clear
              </button>
            )}
          >
            {displaySubagents.length === 0 ? (
              <div className="text-sm text-muted">No active tasks</div>
            ) : (
              <div className="space-y-1">
                {displaySubagents.map(agent => (
                  <SubagentCard
                    key={agent.id}
                    agent={agent}
                    getAgentTodos={api.subagents.getAgentTodos}
                    onDismiss={handleDismissSubagent}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Files section */}
          <CollapsibleSection
            title="Files"
            expanded={filesExpanded}
            onToggle={() => setFilesExpanded(!filesExpanded)}
            className="border-t border-border px-3 pb-3 max-h-64 overflow-y-auto"
            headerAction={selectedProject && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  api.files.showInFinder(selectedProject.rootPath)
                }}
                className="text-muted hover:text-foreground text-sm"
                title="Show in Finder"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              </button>
            )}
          >
            {selectedProject && (
              <div className="text-xs text-muted truncate mb-2" title={selectedProject.rootPath}>
                {selectedProject.name}
              </div>
            )}
            {fileTree.length > 0 && (
              <div className="space-y-0.5">
                {fileTree.map(node => (
                  <FileTreeNode
                    key={node.path}
                    node={node}
                    selectedPath={selectedFilePath}
                    onSelect={setSelectedFilePath}
                    depth={0}
                    dirtyPaths={dirtyPaths}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Terminals section */}
          <CollapsibleSection
            title="Terminals"
            expanded={terminalsExpanded}
            onToggle={() => setTerminalsExpanded(!terminalsExpanded)}
            className="border-t border-border px-3 pb-3 overflow-y-auto"
            headerAction={selectedProject && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  addTerminal(selectedProject.id)
                }}
                className="text-muted hover:text-foreground text-lg leading-none px-1"
                title="New Terminal"
              >
                +
              </button>
            )}
          >
            {currentTerminals.length === 0 ? (
              <div className="text-sm text-muted">No terminals</div>
            ) : (
              <div className="space-y-1">
                {currentTerminals.map(session => (
                  <TerminalListItem
                    key={session.id}
                    session={session}
                    isActive={session.id === activeTerminalId}
                    isEditing={session.id === editingTerminalId}
                    onSelect={() => setActiveTerminalByProject(prev => new Map(prev).set(selectedProject!.id, session.id))}
                    onRemove={() => removeTerminal(selectedProject!.id, session.id)}
                    onStartEdit={() => setEditingTerminalId(session.id)}
                    onRename={(name) => renameTerminal(selectedProject!.id, session.id, name)}
                    onCancelEdit={() => setEditingTerminalId(null)}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>
        </aside>
        </Panel>

        <PanelResizeHandle style={{ width: 4, background: 'var(--color-border)', cursor: 'col-resize' }} />

        {/* Main panel - File preview or Beans Board */}
        <Panel id="main" minSize="10%">
        {viewMode === 'board' ? (
          <BeansBoard beans={beans} projectId={selectedProject!.id} api={api} />
        ) : (
          <main className="h-full bg-background flex flex-col overflow-hidden">
            {selectedFilePath && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <span className="text-sm text-muted truncate">{selectedFilePath}</span>
                <div className="flex bg-item-bg rounded-md p-0.5">
                  <button
                    onClick={() => setMarkdownViewMode('rendered')}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      markdownViewMode === 'rendered'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted hover:text-foreground'
                    }`}
                  >
                    Rendered
                  </button>
                  <button
                    onClick={() => setMarkdownViewMode('raw')}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      markdownViewMode === 'raw'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted hover:text-foreground'
                    }`}
                  >
                    Raw
                  </button>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4">
              {!selectedFilePath ? (
                <p className="text-muted">Select a file to view content</p>
              ) : fileContent === null ? (
                <p className="text-muted">Loading...</p>
              ) : markdownViewMode === 'rendered' ? (
                <article className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          onClick={(e) => {
                            e.preventDefault()
                            if (href) api.app.openExternal(href)
                          }}
                          className="text-accent hover:underline cursor-pointer"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {displayContent}
                  </ReactMarkdown>
                </article>
              ) : (
                <textarea
                  value={displayContent ?? ''}
                  onChange={(e) => {
                    if (selectedFilePath) {
                      setUnsavedChanges(prev => {
                        const next = new Map(prev)
                        // If content matches saved version, remove from unsaved
                        if (e.target.value === fileContent) {
                          next.delete(selectedFilePath)
                        } else {
                          next.set(selectedFilePath, e.target.value)
                        }
                        return next
                      })
                    }
                  }}
                  className="w-full h-full text-xs font-mono text-foreground bg-transparent resize-none outline-none"
                  spellCheck={false}
                />
              )}
            </div>
          </main>
        )}
        </Panel>

        {/* Detail panel - Messages */}
        {showDetailPanel && (
          <>
          <PanelResizeHandle style={{ width: 4, background: 'var(--color-border)', cursor: 'col-resize' }} />
          <Panel
            id="detail"
            panelRef={detailRef}
            defaultSize="30%"
            minSize="5%"
            maxSize="60%"
            onResize={(size) => {
              localStorage.setItem('claude-center-detail-size', String(size.asPercentage))
            }}
          >
          <aside className="h-full bg-panel border-l border-border flex flex-col overflow-hidden">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-medium truncate">
                Session Chat
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => selectedSessionId && api.chat.showSessionInFinder(selectedSessionId)}
                  className="text-muted hover:text-foreground text-sm"
                  title="Show in Finder"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                </button>
                <button
                  onClick={() => setSelectedSessionId(null)}
                  className="text-muted hover:text-foreground text-lg leading-none"
                >
                  ×
                </button>
              </div>
            </div>
            <div ref={messagesContainerRef} onScroll={handleMessagesScroll} className="flex-1 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <p className="text-muted">No messages in this session</p>
              ) : (
                <div className="space-y-4">
                  {messages.map(msg => (
                    <MessageBubble key={msg.messageId} message={msg} />
                  ))}
                </div>
              )}
            </div>
          </aside>
          </Panel>
          </>
        )}
          </PanelGroup>
        </Panel>

        {/* Terminal Panel - renders all terminals from all projects, hides inactive ones */}
        {hasAnyTerminals && (
          <>
            <PanelResizeHandle style={{ height: 4, background: 'var(--color-border)', cursor: 'row-resize' }} />
            <Panel id="terminal" defaultSize="30%" minSize="10%" maxSize="80%">
              <div className="h-full flex flex-col bg-[#1a1a1a]">
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-sidebar border-b border-border">
                  <span className="text-xs font-medium text-foreground">
                    {currentTerminals.find(s => s.id === activeTerminalId)?.name ?? 'Terminal'}
                  </span>
                  <div className="flex items-center gap-2">
                    {currentTerminals.find(s => s.id === activeTerminalId)?.exited && selectedProject && (
                      <button
                        onClick={() => activeTerminalId && restartTerminal(selectedProject.id, activeTerminalId)}
                        className="text-xs px-2 py-0.5 rounded bg-accent text-white hover:bg-accent/80 transition-colors"
                      >
                        Restart
                      </button>
                    )}
                  </div>
                </div>

                {/* Terminal instances from ALL projects - use display:none to keep all PTYs alive */}
                <div className="flex-1 min-h-0 relative">
                  {Array.from(terminalsByProject.entries()).map(([projectId, sessions]) =>
                    sessions.map(session => (
                      <div
                        key={`${session.id}-${session.restartCount}`}
                        className="absolute inset-0"
                        style={{
                          display: projectId === selectedProject?.id && session.id === activeTerminalId
                            ? 'block'
                            : 'none'
                        }}
                      >
                        <Terminal
                          terminalId={`${session.id}-${session.restartCount}`}
                          cwd={projects.find(p => p.id === projectId)?.rootPath}
                          api={api}
                          onExit={() => markTerminalExited(projectId, session.id)}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Panel>
          </>
        )}
      </PanelGroup>

      {/* Remove All Tasks Confirmation Modal */}
      <ConfirmModal
        isOpen={showRemoveAllModal}
        title="Remove All Tasks"
        message={`Are you sure you want to remove all ${displaySubagents.length} task${displaySubagents.length === 1 ? '' : 's'} from the list? This cannot be undone.`}
        confirmLabel="Remove All"
        cancelLabel="Cancel"
        onConfirm={handleRemoveAllTasks}
        onCancel={() => setShowRemoveAllModal(false)}
        variant="danger"
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={themeState.settings}
        customThemes={themeState.customThemes}
        isDark={themeState.isDark}
        onUpdateSettings={themeState.updateSettings}
        onImportTheme={themeState.importTheme}
        api={api}
      />
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set())

  // Check if this message contains only tool_result blocks (system output, not user input)
  const isToolResultOnly = message.content.every(block => block.type === 'tool_result')
  const isUser = message.role === 'user' && !isToolResultOnly

  const toggleResult = (index: number) => {
    setExpandedResults(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // Group consecutive tool_use and tool_result blocks
  const renderContent = () => {
    const elements: React.ReactNode[] = []
    let i = 0

    while (i < message.content.length) {
      const block = message.content[i]

      if (block.type === 'text') {
        elements.push(
          <div key={i} className="whitespace-pre-wrap text-sm">
            {block.text}
          </div>
        )
        i++
      } else if (block.type === 'tool_use') {
        // Render tool use as a compact pill
        elements.push(
          <div key={i} className="flex items-center gap-2 mt-2 first:mt-0">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/50 border border-border text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              {block.name}
            </span>
          </div>
        )
        i++
      } else if (block.type === 'tool_result') {
        const content = typeof block.content === 'string' ? block.content : JSON.stringify(block.content)
        const isLong = content.length > 150
        const isExpanded = expandedResults.has(i)
        const displayContent = isLong && !isExpanded ? content.slice(0, 150) + '...' : content

        elements.push(
          <div key={i} className="mt-2 first:mt-0">
            <div className="rounded-md bg-code-bg border border-code-border overflow-hidden">
              <pre className="p-2 text-xs font-mono text-code-text whitespace-pre-wrap break-all max-h-32 overflow-y-auto leading-relaxed">
                {displayContent}
              </pre>
              {isLong && (
                <button
                  onClick={() => toggleResult(i)}
                  className="w-full px-2 py-1 text-xs text-accent hover:bg-item-hover border-t border-code-border transition-colors"
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          </div>
        )
        i++
      } else {
        i++
      }
    }

    return elements
  }

  // For tool-result-only messages, render without the bubble wrapper
  if (isToolResultOnly) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%]">
          {renderContent()}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 ${
          isUser ? 'bg-accent text-white' : 'bg-item-bg'
        }`}
      >
        {renderContent()}
      </div>
    </div>
  )
}

// Find first markdown file in tree (depth-first)
function findFirstMarkdownFile(nodes: import('../shared/types').FileNode[]): string | null {
  for (const node of nodes) {
    if (node.type === 'file' && /\.(md|mdx|markdown)$/i.test(node.name)) {
      return node.path
    }
    if (node.type === 'directory' && node.children) {
      const found = findFirstMarkdownFile(node.children)
      if (found) return found
    }
  }
  return null
}

// Check if a path exists in the file tree
function pathExistsInTree(nodes: import('../shared/types').FileNode[], path: string): boolean {
  for (const node of nodes) {
    if (node.path === path) return true
    if (node.type === 'directory' && node.children) {
      if (pathExistsInTree(node.children, path)) return true
    }
  }
  return false
}

// Check if a path or any of its descendants are dirty
function pathOrDescendantIsDirty(path: string, dirtyPaths: Set<string>): boolean {
  for (const dirtyPath of dirtyPaths) {
    if (dirtyPath === path || dirtyPath.startsWith(path + '/')) {
      return true
    }
  }
  return false
}

function FileTreeNode({
  node,
  selectedPath,
  onSelect,
  depth,
  dirtyPaths,
}: {
  node: import('../shared/types').FileNode
  selectedPath: string | null
  onSelect: (path: string) => void
  depth: number
  dirtyPaths: Set<string>
}) {
  const [expanded, setExpanded] = useState(depth === 0)
  const isSelected = node.path === selectedPath
  const isMarkdown = node.name.endsWith('.md')
  const paddingLeft = depth * 12 + 4

  if (node.type === 'directory') {
    return (
      <div>
        <div
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 py-0.5 cursor-pointer hover:bg-item-hover rounded text-sm"
          style={{ paddingLeft }}
        >
          <span className="text-muted">{expanded ? '▾' : '▸'}</span>
          <span className={pathOrDescendantIsDirty(node.path, dirtyPaths) ? 'text-amber-500 dark:text-amber-400' : ''}>
            {node.name}
          </span>
        </div>
        {expanded && node.children?.map(child => (
          <FileTreeNode
            key={child.path}
            node={child}
            selectedPath={selectedPath}
            onSelect={onSelect}
            depth={depth + 1}
            dirtyPaths={dirtyPaths}
          />
        ))}
      </div>
    )
  }

  // Only show markdown files
  if (!isMarkdown) return null

  const isDirty = dirtyPaths.has(node.path)

  return (
    <div
      onClick={() => onSelect(node.path)}
      className={`py-0.5 cursor-pointer rounded text-sm truncate ${
        isSelected ? 'bg-item-selected' : 'hover:bg-item-hover'
      } ${isDirty ? 'text-amber-500 dark:text-amber-400' : ''}`}
      style={{ paddingLeft }}
    >
      {node.name}
    </div>
  )
}

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
  className,
  headerAction,
}: {
  title: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
  className?: string
  headerAction?: React.ReactNode
}) {
  return (
    <section className={className}>
      <div className="flex items-center justify-between py-3 sticky top-0 bg-sidebar z-10">
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-xs font-semibold text-muted uppercase tracking-wide hover:text-foreground transition-colors"
        >
          <span>{expanded ? '▾' : '▸'}</span>
          <span>{title}</span>
        </button>
        {headerAction}
      </div>
      {expanded && children}
    </section>
  )
}

export default App
