# Fix Session Discovery

## Problem

Sessions don't appear in Claude Composer until Claude Code updates `sessions-index.json`, which happens lazily (not in real-time). This means:
- The current active session doesn't show up
- Subagents from the current session don't show up (they're filtered by sessionId)

## Root Cause

`src/main/ipc/chat.ts` only reads from `sessions-index.json`:
```typescript
const indexPath = join(projectDir, 'sessions-index.json')
const data = await readFile(indexPath, 'utf-8')
const index = JSON.parse(data)
return index.entries
```

But Claude Code doesn't update this file in real-time - new sessions exist as `.jsonl` files before they're indexed.

## Solution

Scan for `.jsonl` files directly and merge with index data:

1. Read `sessions-index.json` for indexed sessions (has rich metadata)
2. Scan directory for all `.jsonl` files
3. For any `.jsonl` not in index, parse first line to extract basic session info
4. Merge both sources, preferring index data when available

## Implementation

### Step 1: Update `src/main/ipc/chat.ts`

Add helper to parse first message from JSONL:

```typescript
async function parseSessionFromJsonl(filePath: string): Promise<Session | null> {
  try {
    const handle = await open(filePath, 'r')
    const stream = handle.createReadStream({ encoding: 'utf-8' })
    // Read first line only
    let firstLine = ''
    for await (const chunk of stream) {
      firstLine += chunk
      const newlineIdx = firstLine.indexOf('\n')
      if (newlineIdx !== -1) {
        firstLine = firstLine.slice(0, newlineIdx)
        break
      }
    }
    await handle.close()

    if (!firstLine) return null

    const msg = JSON.parse(firstLine)
    const sessionId = basename(filePath, '.jsonl')

    // Extract preview from first user message
    let preview = ''
    if (msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === 'text') {
          preview = block.text.slice(0, 100)
          break
        }
      }
    }

    return {
      id: sessionId,
      projectPath: dirname(filePath),
      startedAt: new Date(msg.timestamp),
      lastMessageAt: new Date(msg.timestamp), // Will be inaccurate but better than nothing
      preview: preview || 'New session',
      messageCount: 1, // Unknown, estimate
    }
  } catch {
    return null
  }
}
```

### Step 2: Update `getSessions()` function

```typescript
export async function getSessions(projectDirId?: string): Promise<Session[]> {
  // ... existing code to find projectDir ...

  const indexPath = join(projectDir, 'sessions-index.json')
  const indexedSessions = new Map<string, Session>()

  // Load indexed sessions
  try {
    const data = await readFile(indexPath, 'utf-8')
    const index = JSON.parse(data)
    for (const entry of index.entries) {
      indexedSessions.set(entry.sessionId, {
        id: entry.sessionId,
        projectPath: entry.projectPath,
        startedAt: new Date(entry.created),
        lastMessageAt: new Date(entry.modified),
        preview: entry.firstPrompt?.slice(0, 100) || 'Empty session',
        messageCount: entry.messageCount,
      })
    }
  } catch {
    // Index doesn't exist or is invalid
  }

  // Scan for unindexed .jsonl files
  const files = await readdir(projectDir)
  for (const file of files) {
    if (!file.endsWith('.jsonl')) continue
    const sessionId = basename(file, '.jsonl')

    if (!indexedSessions.has(sessionId)) {
      const session = await parseSessionFromJsonl(join(projectDir, file))
      if (session) {
        indexedSessions.set(sessionId, session)
      }
    }
  }

  // Sort by lastMessageAt descending
  return Array.from(indexedSessions.values())
    .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
}
```

### Step 3: Update file watcher

In `src/main/watchers/claude-watcher.ts`, also trigger session reload when new `.jsonl` files are added:

```typescript
// JSONL session file changed - invalidate cache and notify
if (filePath.endsWith('.jsonl')) {
  const sessionId = basename(filePath, '.jsonl')
  invalidateSessionCache(sessionId)
  mainWindow.webContents.send('chat:messagesUpdate', { sessionId })

  // Also refresh sessions list in case this is a new session
  const sessions = await getSessions()
  mainWindow.webContents.send('chat:sessionUpdate', sessions)
  return
}
```

## Testing

1. Start Claude Composer with `npm run dev`
2. In a separate terminal, start a new Claude Code session in the claude-center project
3. The new session should appear immediately in the sidebar
4. Subagents from that session should also be visible

## Files to Modify

- `src/main/ipc/chat.ts` - Add JSONL parsing, update getSessions()
- `src/main/watchers/claude-watcher.ts` - Trigger session refresh on new .jsonl files
