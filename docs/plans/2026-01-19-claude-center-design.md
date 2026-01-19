# Claude Composer Dashboard - Implementation Plan

## Overview

A desktop dashboard app for Claude Code showing chat history, subagent statuses, and markdown files.

**Stack:** Electron + React + TypeScript + Tailwind CSS + Vite

## Progress

| Step | Status | Commit |
|------|--------|--------|
| 1. Project Scaffolding | Done | 115d374 |
| 2. IPC Foundation | Done | 115d374 |
| 3. Data Layer | Done | 115d374 |
| 4. File Watching | Done | c426def |
| 5. UI Shell | Done | - |
| 6. Chat History View | Done | - |
| 7. Subagent Status View | Done | - |
| 8. Markdown Browser | Done | - |
| 9. Polish & Package | Pending | - |

## Quick Start (New Session)

```bash
cd /Users/aj/Developer/JS/claude-center
npm run dev  # Launches Electron app
```

To continue implementation, run Steps 4-9 below.

---

## Architecture

IPC-based architecture with clean separation:
- **Main process:** File watching, JSONL parsing, filesystem operations
- **Preload:** Secure API bridge (no nodeIntegration in renderer)
- **Renderer:** Pure React UI, receives clean typed data

## Project Structure

```
claude-center/
├── src/
│   ├── main/
│   │   ├── index.ts              # Entry, window creation
│   │   ├── ipc/handlers.ts       # IPC handler registration
│   │   ├── ipc/chat.ts           # Chat history operations ✓
│   │   ├── ipc/subagents.ts      # Subagent operations ✓
│   │   ├── ipc/files.ts          # Markdown file operations ✓
│   │   └── watchers/             # TODO: File watchers
│   ├── renderer/
│   │   ├── App.tsx               # Basic shell ✓
│   │   ├── components/           # TODO: UI components
│   │   ├── hooks/                # TODO: useIPC hooks
│   │   └── styles/themes.css     # Theme variables ✓
│   ├── shared/types.ts           # Shared interfaces ✓
│   └── preload/index.ts          # Secure IPC bridge ✓
├── tailwind.config.js            ✓
├── vite.config.ts                ✓
├── electron-builder.json         ✓
└── package.json                  ✓
```

## Data Sources

Claude Code stores data in `~/.claude/`:
- `projects/[PROJECT]/sessions-index.json` - Session metadata
- `projects/[PROJECT]/[SESSION].jsonl` - Full conversation history
- `todos/[SESSION]-agent-[ID].json` - Subagent task statuses

---

## Remaining Implementation Steps

### Step 4: File Watching

Create `src/main/watchers/claude-watcher.ts`:

```typescript
// Watch ~/.claude/projects/ for session changes
// Watch ~/.claude/todos/ for subagent changes
// Emit events via mainWindow.webContents.send()
```

Tasks:
- [ ] Set up chokidar watcher for `~/.claude/projects/**/sessions-index.json`
- [ ] Set up chokidar watcher for `~/.claude/projects/**/*.jsonl`
- [ ] Set up chokidar watcher for `~/.claude/todos/*.json`
- [ ] Emit `chat:sessionUpdate` on session changes
- [ ] Emit `subagents:statusChange` on todo file changes
- [ ] Call `invalidateSessionCache()` when session files change

### Step 5: UI Shell

Refactor `src/renderer/App.tsx` into components:

Tasks:
- [ ] Create `components/layout/ThreePanel.tsx` - flex container
- [ ] Create `components/layout/Sidebar.tsx` - collapsible sections
- [ ] Create `components/layout/Header.tsx` - title bar with theme toggle
- [ ] Wire theme toggle to `window.claude.app.setTheme()`
- [ ] Load persisted theme on startup via `window.claude.app.getTheme()`

### Step 6: Chat History View

Tasks:
- [ ] Create `components/chat/SessionList.tsx`
  - Fetch sessions via `window.claude.chat.getSessions()`
  - Group by date (Today, Yesterday, This Week, etc.)
  - Show preview text and message count
- [ ] Create `components/chat/MessageView.tsx`
  - Fetch messages via `window.claude.chat.getMessages(sessionId)`
  - Render user/assistant messages with proper styling
  - Handle tool_use and tool_result content types
- [ ] Create `hooks/useSession.ts` - state management for selected session
- [ ] Subscribe to `chat:sessionUpdate` for live updates

### Step 7: Subagent Status View

Tasks:
- [ ] Create `components/subagents/SubagentList.tsx`
  - Fetch via `window.claude.subagents.getActive()`
  - Show running vs completed status
  - Display current task description
- [ ] Create `components/subagents/TodoList.tsx`
  - Show todo items with status indicators
  - pending (gray), in_progress (blue), completed (green)
- [ ] Subscribe to `subagents:statusChange` for live updates

### Step 8: Markdown Browser

Tasks:
- [ ] Create `components/markdown/FileTree.tsx`
  - "Open Folder" button calls `window.claude.app.openFolder()`
  - Display tree from `window.claude.files.getTree(path)`
  - Expandable directories
- [ ] Create `components/markdown/MarkdownViewer.tsx`
  - Fetch content via `window.claude.files.getContent(path)`
  - Render with react-markdown
- [ ] Set up file watcher for opened folder
- [ ] Subscribe to `files:change` for live updates

### Step 9: Polish & Package

Tasks:
- [ ] Add loading states (skeletons or spinners)
- [ ] Add error boundaries
- [ ] Handle empty states gracefully
- [ ] Test `npm run build` produces working app
- [ ] Test packaged app on macOS

---

## Key Design Decisions

1. **IPC separation** - Renderer never touches filesystem directly
2. **Append-only parsing** - Only read new bytes on file changes
3. **CSS variables for theming** - Easy to add new themes later
4. **Minimal dependencies** - Each library earns its place

## Verification Checklist

- [x] `npm run dev` - app launches with three-panel layout
- [x] Sessions from `~/.claude` appear in sidebar
- [x] Selecting a session shows conversation
- [x] Active subagents show in sidebar with status
- [x] "Open Folder" shows markdown files
- [x] Selecting markdown file shows preview
- [x] Theme toggle works and persists
- [x] Starting a new Claude Code session elsewhere updates dashboard in real-time
