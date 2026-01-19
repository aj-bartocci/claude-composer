# Claude Composer

## CRITICAL: Skill Cascading

**BEFORE invoking ANY skill via the Skill tool:**
1. Run `ls skills/` to check for local overrides
2. If a matching skill exists locally, READ it first
3. Then invoke the skill

This is non-negotiable. Do not skip this step.

---

Dashboard app for monitoring Claude Code sessions.

## Project Goal

A desktop dashboard showing:
- Chat history from Claude Code sessions
- Ongoing subagent statuses
- Markdown files in opened folders

## Stack Decisions

| Choice | Rationale |
|--------|-----------|
| **Electron** | Desktop app with filesystem access for watching ~/.claude/ |
| **React** | Familiar, large ecosystem |
| **Tailwind + CSS variables** | Theming via design system tokens |
| **Vite** | Fast HMR for renderer |
| **IPC architecture** | Main process handles files, renderer is pure UI (Electron security best practice) |

## Architecture

```
Main Process              IPC Bridge              Renderer (React)
─────────────             ──────────              ────────────────
File Watcher    →         Events        →         State Store
Data Reader     ←         Requests      ←         UI Components
```

- Main process: file watching, JSONL parsing, filesystem ops
- Preload: secure API bridge (no nodeIntegration in renderer)
- Renderer: pure React UI, receives clean typed data

## Data Sources

Claude Code stores data in `~/.claude/`:

### Chat History
- `~/.claude/projects/[PROJECT]/[SESSION_ID].jsonl` - Full conversations
- `~/.claude/history.jsonl` - Command history overview

**JSONL format per line:**
```json
{"messageId":"...","sessionId":"...","type":"message","message":{"role":"assistant","content":[...]},"timestamp":1234567890}
```

### Subagent Status
- `~/.claude/todos/[SESSION_ID]-agent-[AGENT_ID].json` - Task lists
- `~/.claude/projects/[PROJECT]/[SESSION_ID]/subagents/agent-*.jsonl` - Subagent conversations

**Todo JSON format:**
```json
[{"content":"Task description","status":"pending|in_progress|completed","id":"..."}]
```

### Key Insight: Append-Only Optimization
JSONL files are append-only. On file change, only read new bytes from last known position - don't re-parse entire file.

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Claude Composer                            [theme toggle] [─□×]│
├────────────────┬────────────────────────────┬───────────────────┤
│  SIDEBAR       │  MAIN CONTENT              │  DETAIL PANEL     │
│  (250px)       │  (flex)                    │  (300px, optional)│
│                │                            │                   │
│  ┌──────────┐  │  Selected session's        │  Message details  │
│  │ Sessions │  │  chat history              │  or markdown      │
│  └──────────┘  │                            │  preview          │
│  ┌──────────┐  │                            │                   │
│  │ Subagents│  │                            │                   │
│  └──────────┘  │                            │                   │
│  ┌──────────┐  │                            │                   │
│  │ Files    │  │                            │                   │
│  └──────────┘  │                            │                   │
└────────────────┴────────────────────────────┴───────────────────┘
```

Three collapsible sidebar sections. Detail panel shows on selection.

## Theming

CSS variables for semantic tokens:
```css
:root {
  --color-background: #ffffff;
  --color-foreground: #1a1a1a;
  --color-muted: #6b7280;
  --color-accent: #3b82f6;
  --color-border: #e5e7eb;
  --color-sidebar: #f9fafb;
  --color-panel: #ffffff;
}

.dark { /* dark overrides */ }
```

Components use `bg-background`, `text-foreground` - never raw colors.

## IPC API Surface

```typescript
interface ClaudeAPI {
  chat: {
    getSessions: (projectPath?: string) => Promise<Session[]>
    getMessages: (sessionId: string) => Promise<Message[]>
    onSessionUpdate: (callback: (session: Session) => void) => void
  }
  subagents: {
    getActive: () => Promise<Subagent[]>
    getTodos: (sessionId: string) => Promise<Todo[]>
    onStatusChange: (callback: (subagent: Subagent) => void) => void
  }
  files: {
    getTree: (rootPath: string) => Promise<FileNode[]>
    getContent: (filePath: string) => Promise<string>
    onFileChange: (callback: (event: FileEvent) => void) => void
  }
  app: {
    getTheme: () => Promise<'light' | 'dark'>
    setTheme: (theme: 'light' | 'dark') => Promise<void>
    openFolder: () => Promise<string | null>
  }
}
```

## Development Approach

**Prefer parallel work with subagents and worktrees:**
- Use `superpowers:dispatching-parallel-agents` for independent tasks
- Use `superpowers:using-git-worktrees` to isolate feature work
- Launch multiple subagents when tasks don't have dependencies
- Example: Build main process IPC handlers in one worktree while building renderer components in another

**Use iterative UI development:**
- Follow `skills/iterative-ui-with-playwright/SKILL.md`
- Code → screenshot → evaluate → adjust loop
- Small increments, verify after each change

## Coding Style

Follow `skills/philosophy-of-software-design/SKILL.md`:
- Deep modules with simple interfaces
- Pull complexity downward
- Define errors out of existence
- Hide information
- Minimize configuration

## Implementation Plan

See `docs/plans/2026-01-19-claude-center-design.md` for step-by-step implementation.

## Current State

`app/` contains a Vite + React scaffold created during skill testing:
- `src/SessionsSidebar.tsx` - Working sidebar component (reference)
- `screenshot.ts` - Playwright screenshot script for iterative dev

Next step: Add Electron (main process, preload, IPC) around this renderer.

## MVP Scope

Lean MVP with theming:
- View chat history (read-only)
- View subagent statuses
- Browse markdown files
- Light/dark theme toggle
- Real-time updates via file watching

No search, filtering, or editing in v1.
