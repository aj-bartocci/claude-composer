# Project-Based Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Projects sidebar section that auto-selects the most recent project and filters all data accordingly.

**Architecture:** New `projects.ts` IPC module discovers projects from `~/.claude/projects/`. Renderer tracks selected project in state and passes it to existing data loaders. Project selection cascades to sessions, subagents, and file tree.

**Tech Stack:** TypeScript, Electron IPC, React hooks

---

## Task 1: Add Project Type

**Files:**
- Modify: `src/shared/types.ts`

**Step 1: Add Project interface**

Add after line 58 (before ClaudeAPI interface):

```typescript
// Project discovered from ~/.claude/projects/
export interface Project {
  id: string         // Directory name (encoded path)
  name: string       // Display name (last path segment)
  rootPath: string   // Full decoded path to code folder
  lastActivity: number // sessions-index.json mtime (ms since epoch)
}
```

**Step 2: Update ClaudeAPI type**

Add `projects` namespace to ClaudeAPI interface (after `app` section, around line 82):

```typescript
  projects: {
    getAll: () => Promise<Project[]>
  }
```

**Step 3: Verify types compile**

Run: `cd /Users/aj/Developer/JS/claude-center && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add Project type and API interface"
```

---

## Task 2: Create Projects IPC Handler

**Files:**
- Create: `src/main/ipc/projects.ts`

**Step 1: Create the projects module**

```typescript
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import type { Project } from '../../shared/types'

const CLAUDE_DIR = join(homedir(), '.claude')
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects')

/**
 * Decode a Claude project directory name to the original path.
 * Claude encodes paths by replacing '/' with '-' and prepending drive info.
 * Example: "-Users-aj-Developer-JS-claude-center" -> "/Users/aj/Developer/JS/claude-center"
 */
function decodeProjectPath(dirName: string): string {
  // Handle the leading dash which represents root '/'
  if (dirName.startsWith('-')) {
    return '/' + dirName.slice(1).replace(/-/g, '/')
  }
  // Windows paths might start differently
  return dirName.replace(/-/g, '/')
}

/**
 * Extract display name from full path (last segment).
 */
function getDisplayName(fullPath: string): string {
  const segments = fullPath.split('/').filter(Boolean)
  return segments[segments.length - 1] || fullPath
}

export async function getAllProjects(): Promise<Project[]> {
  const projects: Project[] = []

  try {
    const projectDirs = await readdir(PROJECTS_DIR)

    for (const dirName of projectDirs) {
      const projectDir = join(PROJECTS_DIR, dirName)
      const indexPath = join(projectDir, 'sessions-index.json')

      try {
        const indexStat = await stat(indexPath)
        const rootPath = decodeProjectPath(dirName)

        projects.push({
          id: dirName,
          name: getDisplayName(rootPath),
          rootPath,
          lastActivity: indexStat.mtimeMs,
        })
      } catch {
        // No sessions-index.json, skip this project
      }
    }
  } catch {
    // Projects dir doesn't exist
  }

  // Sort by most recent activity first
  return projects.sort((a, b) => b.lastActivity - a.lastActivity)
}
```

**Step 2: Verify file created**

Run: `ls -la /Users/aj/Developer/JS/claude-center/src/main/ipc/projects.ts`
Expected: File exists

**Step 3: Commit**

```bash
git add src/main/ipc/projects.ts
git commit -m "feat: add projects IPC handler to discover Claude projects"
```

---

## Task 3: Register Projects Handler

**Files:**
- Modify: `src/main/ipc/handlers.ts`

**Step 1: Add import**

Add to imports at top of file (line 4):

```typescript
import { getAllProjects } from './projects'
```

**Step 2: Add handler registration**

Add after the app handlers (before the closing brace of registerIpcHandlers, around line 58):

```typescript
  // Project handlers
  ipcMain.handle('projects:getAll', async () => {
    return getAllProjects()
  })
```

**Step 3: Verify build**

Run: `cd /Users/aj/Developer/JS/claude-center && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/main/ipc/handlers.ts
git commit -m "feat: register projects:getAll IPC handler"
```

---

## Task 4: Expose Projects in Preload

**Files:**
- Modify: `src/preload/index.ts`

**Step 1: Add Project import**

Update the import on line 2 to include Project:

```typescript
import type { Session, Message, Subagent, Todo, FileNode, FileEvent, Theme, Project, ClaudeAPI } from '../shared/types'
```

**Step 2: Add projects namespace to api object**

Add after the `app` section (before the closing brace, around line 53):

```typescript
  projects: {
    getAll: () =>
      ipcRenderer.invoke('projects:getAll') as Promise<Project[]>,
  },
```

**Step 3: Verify build**

Run: `cd /Users/aj/Developer/JS/claude-center && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat: expose projects API in preload bridge"
```

---

## Task 5: Update Renderer - Add Project State

**Files:**
- Modify: `src/renderer/App.tsx`

**Step 1: Add Project import**

Update the import on line 2:

```typescript
import type { Session, Message, Subagent, Theme, Project, ClaudeAPI } from '../shared/types'
```

**Step 2: Add mock projects to mockApi**

Add to mockApi object (after the `app` section, around line 41):

```typescript
  projects: {
    getAll: async () => [
      { id: '-mock-project-1', name: 'mock-project-1', rootPath: '/mock/project-1', lastActivity: Date.now() },
      { id: '-mock-project-2', name: 'mock-project-2', rootPath: '/mock/project-2', lastActivity: Date.now() - 86400000 },
    ],
  },
```

**Step 3: Add project state**

Add after line 51 (after subagents state):

```typescript
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
```

**Step 4: Verify build**

Run: `cd /Users/aj/Developer/JS/claude-center && npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: add project state to renderer"
```

---

## Task 6: Load Projects on Mount

**Files:**
- Modify: `src/renderer/App.tsx`

**Step 1: Add projects loading effect**

Add after the theme loading effect (around line 67), before the sessions loading effect:

```typescript
  // Load projects and auto-select most recent
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const allProjects = await api.projects.getAll()
        setProjects(allProjects)
        // Auto-select most recent (already sorted by lastActivity)
        if (allProjects.length > 0) {
          setSelectedProject(allProjects[0])
        }
      } catch (err) {
        console.error('Failed to load projects:', err)
      }
    }
    loadProjects()
  }, [])
```

**Step 2: Verify build**

Run: `cd /Users/aj/Developer/JS/claude-center && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: load projects on mount and auto-select most recent"
```

---

## Task 7: Filter Sessions by Project

**Files:**
- Modify: `src/renderer/App.tsx`

**Step 1: Update sessions loading effect**

Modify the sessions loading effect (starting around line 79) to depend on selectedProject:

```typescript
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

    // Subscribe to session updates
    const unsubscribe = api.chat.onSessionUpdate((updatedSessions) => {
      // Filter to selected project
      const filtered = updatedSessions.filter(s =>
        s.projectPath === selectedProject.rootPath
      )
      setSessions(filtered)
    })
    return unsubscribe
  }, [selectedProject])
```

**Step 2: Verify build**

Run: `cd /Users/aj/Developer/JS/claude-center && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: filter sessions by selected project"
```

---

## Task 8: Update getSessions to Filter by Project ID

**Files:**
- Modify: `src/main/ipc/chat.ts`

**Step 1: Fix the project filtering logic**

Update the `getSessions` function (around lines 42-55) to match by project directory ID:

```typescript
export async function getSessions(projectId?: string): Promise<Session[]> {
  const sessions: Session[] = []

  try {
    const projectDirs = await readdir(PROJECTS_DIR)

    for (const projectDir of projectDirs) {
      // If filtering by project, check if directory matches
      if (projectId && projectDir !== projectId) {
        continue
      }

      const indexPath = join(PROJECTS_DIR, projectDir, 'sessions-index.json')

      try {
        const indexContent = await readFile(indexPath, 'utf-8')
        const index: SessionsIndex = JSON.parse(indexContent)

        for (const entry of index.entries) {
          sessions.push({
            id: entry.sessionId,
            projectPath: entry.projectPath,
            startedAt: new Date(entry.created),
            lastMessageAt: new Date(entry.modified),
            preview: entry.firstPrompt.slice(0, 100),
            messageCount: entry.messageCount,
          })
        }
      } catch {
        // Index file doesn't exist or is invalid, skip
      }
    }
  } catch {
    // Projects dir doesn't exist
  }

  // Sort by last message time, most recent first
  return sessions.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
}
```

**Step 2: Verify build**

Run: `cd /Users/aj/Developer/JS/claude-center && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/main/ipc/chat.ts
git commit -m "fix: filter sessions by project directory ID"
```

---

## Task 9: Auto-Load File Tree from Project

**Files:**
- Modify: `src/renderer/App.tsx`

**Step 1: Remove folderPath state and handleOpenFolder**

Delete these lines (around 55-58 and 181-187):
- `const [folderPath, setFolderPath] = useState<string | null>(null)`
- The entire `handleOpenFolder` function

**Step 2: Update file tree loading effect**

Replace the file tree loading effect (around line 146) to use selectedProject.rootPath:

```typescript
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
      } catch (err) {
        console.error('Failed to load file tree:', err)
      }
    }
    loadTree()
  }, [selectedProject])
```

**Step 3: Verify build**

Run: `cd /Users/aj/Developer/JS/claude-center && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: auto-load file tree from selected project folder"
```

---

## Task 10: Add Projects Section to Sidebar

**Files:**
- Modify: `src/renderer/App.tsx`

**Step 1: Add Projects section to sidebar**

Add this section at the top of the sidebar (inside the `<aside>` element, around line 216), before the Sessions section:

```typescript
          {/* Projects section */}
          <section className="p-3 border-b border-border">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
              Projects
            </h2>
            {projects.length === 0 ? (
              <div className="text-sm text-muted">No projects found</div>
            ) : (
              <div className="space-y-1">
                {projects.map(project => (
                  <div
                    key={project.id}
                    onClick={() => {
                      setSelectedProject(project)
                      setSelectedSessionId(null)
                      setSelectedFilePath(null)
                    }}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      project.id === selectedProject?.id
                        ? 'bg-item-selected'
                        : 'bg-item-bg hover:bg-item-hover'
                    }`}
                  >
                    <div className="text-sm truncate">{project.name}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
```

**Step 2: Remove Open folder button from Files section**

Delete these lines from the Files section (around lines 275-285):

```typescript
            <button
              onClick={handleOpenFolder}
              className="text-sm text-accent hover:underline mb-2"
            >
              {folderPath ? 'Change folder...' : 'Open folder...'}
            </button>
            {folderPath && (
              <div className="text-xs text-muted truncate mb-2" title={folderPath}>
                {folderPath.split('/').pop()}
              </div>
            )}
```

**Step 3: Verify build**

Run: `cd /Users/aj/Developer/JS/claude-center && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: add Projects sidebar section, remove Open folder button"
```

---

## Task 11: Filter Subagents by Project

**Files:**
- Modify: `src/renderer/App.tsx`

**Step 1: Update subagents loading effect**

Modify the subagents loading effect (around line 128) to filter by session IDs from the selected project:

```typescript
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
        setSubagents(filtered)
      } catch (err) {
        console.error('Failed to load subagents:', err)
      }
    }
    loadSubagents()

    const unsubscribe = api.subagents.onStatusChange(() => {
      loadSubagents()
    })
    return unsubscribe
  }, [selectedProject, sessions])
```

**Step 2: Verify build**

Run: `cd /Users/aj/Developer/JS/claude-center && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: filter subagents by selected project's sessions"
```

---

## Task 12: Final Integration Test

**Step 1: Start the app**

Run: `cd /Users/aj/Developer/JS/claude-center && npm run dev`

**Step 2: Manual verification checklist**

- [ ] Projects section shows at top of sidebar
- [ ] Most recent project is auto-selected on launch
- [ ] Clicking a different project updates sessions, subagents, and files
- [ ] Sessions show only for selected project
- [ ] File tree shows markdown files from project's code folder
- [ ] No "Open folder..." button remains

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete project-based navigation

- Projects sidebar auto-selects most recent on launch
- Sessions, subagents, and files filtered by selected project
- Removed manual folder selection in favor of project discovery"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add Project type to shared types |
| 2 | Create projects.ts IPC handler |
| 3 | Register handler in handlers.ts |
| 4 | Expose projects in preload |
| 5 | Add project state to renderer |
| 6 | Load projects on mount |
| 7 | Filter sessions by project |
| 8 | Fix getSessions filtering logic |
| 9 | Auto-load file tree from project |
| 10 | Add Projects sidebar section |
| 11 | Filter subagents by project |
| 12 | Final integration test |
