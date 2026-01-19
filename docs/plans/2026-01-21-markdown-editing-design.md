# Markdown File Editing

## Overview

Add the ability to edit markdown files directly in Claude Composer when viewing in raw mode. Changes are kept in memory until explicitly saved with Cmd+S, allowing users to make edits across multiple files before saving.

## Requirements

- Raw view becomes an editable textarea
- Cmd+S (Mac) / Ctrl+S (Windows) saves the current file
- Unsaved files show with amber text color in file explorer
- Parent folders cascade the amber color if any descendant has unsaved changes
- Switching files preserves unsaved edits (stored in memory)

## Design

### State Management

New state to track unsaved changes across files:

```typescript
// Map of filePath -> edited content (only for files with unsaved changes)
const [unsavedChanges, setUnsavedChanges] = useState<Map<string, string>>(new Map())
```

**Behavior:**
- When user edits a file, store edited content in `unsavedChanges` map
- When displaying a file, check `unsavedChanges` first - use that content if present
- When saving, write via IPC then remove entry from map
- Map persists across file navigation

**Derived helpers:**
- `hasUnsavedChanges(filePath)` - check if file has unsaved edits
- `folderHasUnsavedChanges(folderPath)` - check if any file under folder has unsaved edits

### UI Changes

**Raw view editor (App.tsx):**
- Replace `<pre>` with `<textarea>` in raw view mode
- Same monospace styling
- `onChange` updates `unsavedChanges` map
- Textarea fills available space

**File explorer indicators:**
- Files with unsaved changes: `text-amber-500` (light) / `text-amber-400` (dark)
- Folders with unsaved descendants: same amber color
- `FileTreeNode` receives set of dirty paths to check

**Keyboard shortcut:**
- Listen for Cmd+S / Ctrl+S at App level
- Save current file if it has unsaved changes
- Prevent default browser save dialog

### IPC Changes

**New API method:**

```typescript
files: {
  // ... existing methods
  saveContent: (filePath: string, content: string) => Promise<void>
}
```

**Main process handler:**
- Validate file is markdown extension
- Validate path is within allowed project directory
- Write content via `fs.promises.writeFile`

## Files to Modify

| File | Changes |
|------|---------|
| `src/shared/types.ts` | Add `saveContent` to files API |
| `src/main/ipc/files.ts` | Add `saveFileContent()` function |
| `src/main/ipc/handlers.ts` | Register `files:saveContent` handler |
| `src/preload/index.ts` | Expose `saveContent` in bridge |
| `src/renderer/App.tsx` | Unsaved state, textarea, Cmd+S, color indicators |

## Implementation Order

1. Add IPC infrastructure (types, handler, preload)
2. Add unsaved changes state and textarea editor
3. Add Cmd+S save functionality
4. Add unsaved indicator colors in file explorer
