# Per-Project Terminal Persistence

## Overview

Terminals should persist per project while the app is open. When switching between projects, each project's terminals remain alive in the background with their full history preserved.

## Current State

- Terminal sessions stored in flat React state: `terminalSessions: TerminalSession[]`
- Active terminal tracked globally: `activeTerminalId: string | null`
- Switching projects changes terminal `cwd` but doesn't isolate terminals
- PTY processes tracked in main process by terminal ID

## Design

### State Structure

Replace flat arrays with maps keyed by project ID:

```typescript
// Before
const [terminalSessions, setTerminalSessions] = useState<TerminalSession[]>([])
const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null)

// After
const [terminalsByProject, setTerminalsByProject] = useState<Map<string, TerminalSession[]>>(new Map())
const [activeTerminalByProject, setActiveTerminalByProject] = useState<Map<string, string | null>>(new Map())
```

Derive current project's terminals:

```typescript
const currentTerminals = selectedProject
  ? (terminalsByProject.get(selectedProject.id) ?? [])
  : []
const activeTerminalId = selectedProject
  ? (activeTerminalByProject.get(selectedProject.id) ?? null)
  : null
```

### Rendering Strategy

Render ALL terminals from ALL projects to keep xterm instances mounted and PTY connections alive. Use CSS to show only the active project's active terminal:

```tsx
{Array.from(terminalsByProject.entries()).map(([projectId, sessions]) => (
  sessions.map(session => (
    <div
      key={`${session.id}-${session.restartCount}`}
      style={{
        display: projectId === selectedProject?.id && session.id === activeTerminalId
          ? 'block'
          : 'none'
      }}
    >
      <Terminal
        terminalId={session.id}
        cwd={projects.find(p => p.id === projectId)?.rootPath}
        onExit={() => markTerminalExited(projectId, session.id)}
      />
    </div>
  ))
))}
```

Benefits:
- Preserves xterm scroll buffer and cursor position
- PTY connections stay alive (no data loss)
- Each terminal keeps its original project's `cwd`

### Helper Function Updates

All terminal helpers accept `projectId` parameter:

- `addTerminal(projectId)` - adds to project's array in map
- `removeTerminal(projectId, terminalId)` - removes from project's array, kills PTY
- `markTerminalExited(projectId, terminalId)` - updates exited flag
- `renameTerminal(projectId, terminalId, name)` - updates name
- `restartTerminal(projectId, terminalId)` - increments restartCount

### Cleanup

When a project disappears from the list, clean up its terminals:

```typescript
useEffect(() => {
  const projectIds = new Set(projects.map(p => p.id))

  terminalsByProject.forEach((sessions, projectId) => {
    if (!projectIds.has(projectId)) {
      sessions.forEach(s => api.terminal.kill(s.id))
      // Remove from state
    }
  })
}, [projects])
```

### Scope Limitations

- No persistence across app restarts (terminals are in-memory only)
- No terminal history capture/replay
- Memory scales with total terminals across all projects (~2-5MB per xterm instance)

## Files to Modify

- `src/renderer/App.tsx` - State structure, helpers, rendering logic
- `src/renderer/components/TerminalListItem.tsx` - May need projectId prop for callbacks

## Implementation Steps

1. Update state from flat arrays to project-keyed maps
2. Update all helper functions to accept projectId
3. Update terminal rendering to iterate all projects
4. Update sidebar terminal list to use derived currentTerminals
5. Add cleanup effect for removed projects
6. Test switching between projects preserves terminal state
