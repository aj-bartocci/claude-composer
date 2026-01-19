# Markdown Editing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable editing markdown files in raw view mode with Cmd+S to save, and amber color indicators for unsaved files that cascade to parent folders.

**Architecture:** Add `saveContent` IPC method for writing files. Track unsaved changes in a React state Map keyed by file path. Pass dirty paths to FileTreeNode for amber coloring.

**Tech Stack:** Electron IPC, React state, Tailwind CSS

---

### Task 1: Add saveContent to IPC types

**Files:**
- Modify: `src/shared/types.ts:134-138`

**Step 1: Add saveContent to ClaudeAPI files interface**

In `src/shared/types.ts`, add `saveContent` to the files object in ClaudeAPI interface:

```typescript
  files: {
    getTree: (rootPath: string) => Promise<FileNode[]>
    getContent: (filePath: string) => Promise<string>
    saveContent: (filePath: string, content: string) => Promise<void>
    onFileChange: (callback: (event: FileEvent) => void) => () => void
  }
```

**Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add saveContent to files IPC API type"
```

---

### Task 2: Implement saveFileContent in main process

**Files:**
- Modify: `src/main/ipc/files.ts`

**Step 1: Add saveFileContent function**

Add this function after `getFileContent` in `src/main/ipc/files.ts`:

```typescript
export async function saveFileContent(filePath: string, content: string): Promise<void> {
  // Verify it's a markdown file
  const ext = extname(filePath).toLowerCase()
  if (!MARKDOWN_EXTENSIONS.includes(ext)) {
    throw new Error('Only markdown files can be saved')
  }

  await writeFile(filePath, content, 'utf-8')
}
```

**Step 2: Add writeFile import**

Update the import at top of file:

```typescript
import { readFile, readdir, stat, writeFile } from 'fs/promises'
```

**Step 3: Commit**

```bash
git add src/main/ipc/files.ts
git commit -m "feat: add saveFileContent function to write markdown files"
```

---

### Task 3: Register IPC handler

**Files:**
- Modify: `src/main/ipc/handlers.ts:50-57`

**Step 1: Import saveFileContent**

Update the import at line 4:

```typescript
import { getFileTree, getFileContent, saveFileContent } from './files'
```

**Step 2: Add handler after files:getContent handler**

After line 57, add:

```typescript
  ipcMain.handle('files:saveContent', async (_event, filePath: string, content: string) => {
    return saveFileContent(filePath, content)
  })
```

**Step 3: Commit**

```bash
git add src/main/ipc/handlers.ts
git commit -m "feat: register files:saveContent IPC handler"
```

---

### Task 4: Expose in preload bridge

**Files:**
- Modify: `src/preload/index.ts:44-54`

**Step 1: Add saveContent to files object**

After line 48 (`getContent`), add:

```typescript
    saveContent: (filePath: string, content: string) =>
      ipcRenderer.invoke('files:saveContent', filePath, content),
```

**Step 2: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat: expose files:saveContent in preload bridge"
```

---

### Task 5: Add unsavedChanges state and mockApi

**Files:**
- Modify: `src/renderer/App.tsx`

**Step 1: Add unsavedChanges state**

After line 155 (`const [fileContent, setFileContent] = useState<string | null>(null)`), add:

```typescript
  const [unsavedChanges, setUnsavedChanges] = useState<Map<string, string>>(new Map())
```

**Step 2: Add saveContent to mockApi**

In the mockApi.files object (around line 77), add after getContent:

```typescript
    saveContent: async () => {},
```

**Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: add unsavedChanges state for tracking edits"
```

---

### Task 6: Replace raw view pre with editable textarea

**Files:**
- Modify: `src/renderer/App.tsx:1083-1087`

**Step 1: Create helper to get display content**

Add this before the return statement in the App component (around line 800):

```typescript
  // Get content to display - prefer unsaved version if exists
  const displayContent = useMemo(() => {
    if (!selectedFilePath) return null
    return unsavedChanges.get(selectedFilePath) ?? fileContent
  }, [selectedFilePath, unsavedChanges, fileContent])

  // Check if current file has unsaved changes
  const currentFileIsDirty = selectedFilePath ? unsavedChanges.has(selectedFilePath) : false
```

**Step 2: Replace pre with textarea in raw view**

Replace lines 1083-1087:

```typescript
              ) : (
                <pre className="text-xs whitespace-pre-wrap font-mono text-foreground">
                  {fileContent}
                </pre>
              )}
```

With:

```typescript
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
```

**Step 3: Update rendered view to use displayContent**

Also update line 1080 to use `displayContent` instead of `fileContent`:

```typescript
                  {displayContent}
```

**Step 4: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: replace raw view pre with editable textarea"
```

---

### Task 7: Add Cmd+S save keyboard shortcut

**Files:**
- Modify: `src/renderer/App.tsx`

**Step 1: Add save handler and keyboard listener**

Add this useEffect after the displayContent useMemo (around line 810):

```typescript
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
```

**Step 2: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: add Cmd+S keyboard shortcut to save files"
```

---

### Task 8: Add unsaved indicator to file explorer

**Files:**
- Modify: `src/renderer/App.tsx:1341-1395`

**Step 1: Create helper for dirty path detection**

Add this function before `FileTreeNode` (around line 1340):

```typescript
// Check if a path or any of its descendants are dirty
function pathOrDescendantIsDirty(path: string, dirtyPaths: Set<string>): boolean {
  for (const dirtyPath of dirtyPaths) {
    if (dirtyPath === path || dirtyPath.startsWith(path + '/')) {
      return true
    }
  }
  return false
}
```

**Step 2: Update FileTreeNode props**

Update the FileTreeNode function signature to accept dirtyPaths:

```typescript
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
```

**Step 3: Add dirty styling to directories**

Update the directory span (line 1366) to apply amber color when dirty:

```typescript
          <span className={pathOrDescendantIsDirty(node.path, dirtyPaths) ? 'text-amber-500 dark:text-amber-400' : ''}>
            {node.name}
          </span>
```

**Step 4: Pass dirtyPaths to child nodes**

Update the recursive FileTreeNode call (lines 1369-1376):

```typescript
          <FileTreeNode
            key={child.path}
            node={child}
            selectedPath={selectedPath}
            onSelect={onSelect}
            depth={depth + 1}
            dirtyPaths={dirtyPaths}
          />
```

**Step 5: Add dirty styling to files**

Update the file div (lines 1384-1393):

```typescript
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
```

**Step 6: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: add amber color indicator for unsaved files in explorer"
```

---

### Task 9: Pass dirtyPaths to FileTreeNode from sidebar

**Files:**
- Modify: `src/renderer/App.tsx`

**Step 1: Create dirtyPaths set**

Add this useMemo near the other display helpers (around line 815):

```typescript
  // Set of file paths with unsaved changes
  const dirtyPaths = useMemo(() => new Set(unsavedChanges.keys()), [unsavedChanges])
```

**Step 2: Find and update FileTreeNode usage in sidebar**

Search for where FileTreeNode is rendered in the sidebar (in the Files section) and add the dirtyPaths prop. It should look like:

```typescript
                <FileTreeNode
                  key={node.path}
                  node={node}
                  selectedPath={selectedFilePath}
                  onSelect={setSelectedFilePath}
                  depth={0}
                  dirtyPaths={dirtyPaths}
                />
```

**Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: pass dirtyPaths to FileTreeNode in sidebar"
```

---

### Task 10: Test the implementation

**Step 1: Run the app**

```bash
npm run dev
```

**Step 2: Manual testing checklist**

- [ ] Select a markdown file
- [ ] Switch to raw view
- [ ] Edit the content - verify file name turns amber
- [ ] Navigate to a different file - verify edit is preserved
- [ ] Navigate back - verify edited content is shown
- [ ] Press Cmd+S - verify amber color disappears
- [ ] Verify parent folders show amber when child is dirty
- [ ] Verify rendered view shows unsaved content

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete markdown file editing with unsaved indicators"
```
