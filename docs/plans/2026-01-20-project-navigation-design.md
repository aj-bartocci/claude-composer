# Project-Based Navigation Design

## Overview

Transform the app from showing all data to being project-centric. A "Projects" section at the top of the sidebar lists all known Claude Code projects. On launch, the most recently active project is auto-selected. All other sections (Sessions, Subagents, Files) filter to show only data for the selected project.

## Decisions

| Aspect | Decision |
|--------|----------|
| Project source | `~/.claude/projects/` directory |
| UI placement | "Projects" section at top of sidebar |
| Initial state | Auto-select most recent project |
| Persistence | None - always fresh start with most recent |
| Filtering | Sessions, subagents, files all scoped to selected project |

## UI Layout

```
┌────────────────┐
│  SIDEBAR       │
│                │
│  ┌──────────┐  │
│  │ Projects │  │  ← clickable list
│  │ ● claude-center    │
│  │   my-api-server    │
│  │   website-redesign │
│  └──────────┘  │
│  ┌──────────┐  │
│  │ Sessions │  │  ← filtered to selected project
│  └──────────┘  │
│  ┌──────────┐  │
│  │ Subagents│  │  ← filtered to selected project
│  └──────────┘  │
│  ┌──────────┐  │
│  │ Files    │  │  ← markdown from project folder
│  └──────────┘  │
└────────────────┘
```

- **Projects section**: Always expanded, shows all discovered projects. Selected project has visual indicator.
- **Sessions/Subagents**: Only show items for the selected project.
- **Files section**: Automatically loads file tree from the project's actual code folder path.
- **"Open folder..." button**: Removed - project selection replaces it.

## Data Flow

### On App Launch

1. Scan `~/.claude/projects/` for all project directories
2. For each project, read `sessions-index.json` modification time
3. Auto-select the project with the most recent timestamp
4. Load that project's sessions, subagents, and file tree

### On Project Selection

1. Update selected project state
2. Call `getSessions(projectPath)` with selected project
3. Call `getTodos(sessionId)` for sessions in that project only
4. Call `getFileTree(projectRootPath)` using the project's actual code folder path

### Project Path Mapping

Claude stores projects by encoded path. The directory name in `~/.claude/projects/` is the actual project folder path (URL-encoded). Decode this to:
- Display a friendly name (last path segment)
- Know where to load the file tree from

### File Watchers

No change needed - watchers already monitor all of `~/.claude/`. The renderer filters displayed data based on selected project.

## Implementation Changes

### Main Process (`src/main/ipc/`)

1. **New handler: `projects:getAll`** - Scans `~/.claude/projects/`, returns list of projects with:
   - `id`: directory name (encoded path)
   - `name`: decoded last path segment (friendly display name)
   - `rootPath`: full decoded path to the code folder
   - `lastActivity`: `sessions-index.json` modification timestamp

2. **Update `chat.ts`** - Wire up `projectPath` parameter in `getSessions()`

3. **Update `subagents.ts`** - Filter `getTodos()` by project

### Preload (`src/preload/index.ts`)

Add `projects.getAll()` to the exposed API

### Renderer (`src/renderer/App.tsx`)

1. Add `projects` and `selectedProject` state
2. On mount: load projects, select most recent
3. On project change: reload sessions, subagents, file tree
4. New `ProjectsSidebar` component (or add section to existing sidebar)
5. Remove "Open folder..." button

### Shared Types (`src/shared/types.ts`)

```typescript
interface Project {
  id: string
  name: string
  rootPath: string
  lastActivity: number
}
```

## Out of Scope

- Remembering last selected project between launches
- Adding new projects from arbitrary folders
- Project search/filtering
- Project deletion or management
