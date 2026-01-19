# Settings and Themes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Bean:** `.beans/settings-and-themes.md`

**Goal:** Add a settings modal with custom theme support, including a Neon Night example theme.

**Architecture:** Extend existing electron-store to persist appearance settings (mode, custom theme). Add IPC handlers for theme file operations. Create SettingsModal component that replaces the current theme toggle button. Custom themes stored in `~/.claude-center/themes/` override CSS variables.

**Tech Stack:** React, Tailwind, electron-store, TypeScript, IPC

---

## Task 1: Add Settings Types

**Files:**
- Modify: `src/shared/types.ts`

**Step 1: Add theme and settings types at end of file**

```typescript
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
}

// Appearance settings persisted to disk
export interface AppearanceSettings {
  mode: ColorMode
  customTheme: string | null  // theme id, null = default
}
```

**Step 2: Extend ClaudeAPI interface - update the `app` section**

```typescript
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
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: Errors about missing implementations (that's expected).

**Step 4: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add settings and custom theme types"
```

---

## Task 2: Add Theme IPC Handlers

**Files:**
- Create: `src/main/ipc/themes.ts`
- Modify: `src/main/ipc/handlers.ts`

**Step 1: Create themes.ts**

```typescript
import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { ThemeFile, CustomTheme } from '../../shared/types'

const THEMES_DIR = path.join(app.getPath('home'), '.claude-center', 'themes')

async function ensureThemesDir(): Promise<void> {
  await fs.mkdir(THEMES_DIR, { recursive: true })
}

export async function getCustomThemes(): Promise<CustomTheme[]> {
  await ensureThemesDir()

  try {
    const files = await fs.readdir(THEMES_DIR)
    const themes: CustomTheme[] = []

    for (const file of files) {
      if (!file.endsWith('.json')) continue

      try {
        const filePath = path.join(THEMES_DIR, file)
        const content = await fs.readFile(filePath, 'utf-8')
        const themeFile: ThemeFile = JSON.parse(content)

        themes.push({
          id: file.replace('.json', ''),
          name: themeFile.name,
          file: themeFile,
        })
      } catch {
        // Skip invalid theme files
      }
    }

    return themes
  } catch {
    return []
  }
}

export async function importTheme(sourcePath: string): Promise<CustomTheme> {
  await ensureThemesDir()

  const content = await fs.readFile(sourcePath, 'utf-8')
  const themeFile: ThemeFile = JSON.parse(content)

  const id = themeFile.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const destPath = path.join(THEMES_DIR, `${id}.json`)

  await fs.writeFile(destPath, content, 'utf-8')

  return {
    id,
    name: themeFile.name,
    file: themeFile,
  }
}

export async function ensureDefaultThemes(): Promise<void> {
  await ensureThemesDir()

  const neonNightPath = path.join(THEMES_DIR, 'neon-night.json')

  try {
    await fs.access(neonNightPath)
  } catch {
    const neonNight: ThemeFile = {
      name: 'Neon Night',
      dark: {
        background: '#0a0a0f',
        foreground: '#e0e0ff',
        muted: '#7878a0',
        accent: '#ff00ff',
        border: '#2a2a3f',
        sidebar: '#0d0d14',
        panel: '#12121a',
        itemBg: '#16161f',
        itemHover: '#1f1f2e',
        itemSelected: '#2a1a3a',
        codeBg: '#0c0c12',
        codeBorder: '#2a2a3f',
        codeText: '#c0c0e0',
      },
    }
    await fs.writeFile(neonNightPath, JSON.stringify(neonNight, null, 2), 'utf-8')
  }
}
```

**Step 2: Update handlers.ts - add imports**

```typescript
import { getCustomThemes, importTheme, ensureDefaultThemes } from './themes'
import type { Theme, AppearanceSettings } from '../../shared/types'
```

**Step 3: Update Store type in handlers.ts**

```typescript
const store = new Store<{
  theme: Theme
  lastProjectId?: string
  beansVisibleColumns?: Record<string, string[]>
  appearanceSettings?: AppearanceSettings
}>({
  defaults: {
    theme: 'dark',
    appearanceSettings: { mode: 'system', customTheme: null }
  }
})
```

**Step 4: Add new handlers in registerIpcHandlers**

```typescript
  ipcMain.handle('app:getAppearanceSettings', () => {
    return store.get('appearanceSettings') ?? { mode: 'system', customTheme: null }
  })

  ipcMain.handle('app:setAppearanceSettings', (_event, settings: AppearanceSettings) => {
    store.set('appearanceSettings', settings)
    mainWindow.webContents.send('app:appearanceChanged', settings)
  })

  ipcMain.handle('app:getCustomThemes', async () => {
    return getCustomThemes()
  })

  ipcMain.handle('app:importTheme', async (_event, sourcePath: string) => {
    return importTheme(sourcePath)
  })

  ipcMain.handle('app:openFile', async (_event, filters?: { name: string; extensions: string[] }[]) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters ?? [{ name: 'All Files', extensions: ['*'] }],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  // Ensure default themes exist
  ensureDefaultThemes().catch(console.error)
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 6: Commit**

```bash
git add src/main/ipc/themes.ts src/main/ipc/handlers.ts
git commit -m "feat: add theme IPC handlers and neon-night default"
```

---

## Task 3: Update Preload Script

**Files:**
- Modify: `src/preload/index.ts`

**Step 1: Add new methods to the app object**

```typescript
  app: {
    getTheme: () =>
      ipcRenderer.invoke('app:getTheme'),
    setTheme: (theme: 'light' | 'dark') =>
      ipcRenderer.invoke('app:setTheme', theme),
    getAppearanceSettings: () =>
      ipcRenderer.invoke('app:getAppearanceSettings'),
    setAppearanceSettings: (settings: { mode: string; customTheme: string | null }) =>
      ipcRenderer.invoke('app:setAppearanceSettings', settings),
    getCustomThemes: () =>
      ipcRenderer.invoke('app:getCustomThemes'),
    importTheme: (sourcePath: string) =>
      ipcRenderer.invoke('app:importTheme', sourcePath),
    openFolder: () =>
      ipcRenderer.invoke('app:openFolder'),
    openFile: (filters?: { name: string; extensions: string[] }[]) =>
      ipcRenderer.invoke('app:openFile', filters),
    openExternal: (url: string) =>
      ipcRenderer.invoke('app:openExternal', url),
  },
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat: add appearance settings methods to preload"
```

---

## Task 4: Create useTheme Hook

**Files:**
- Create: `src/renderer/hooks/useTheme.ts`

**Step 1: Create the hook**

```typescript
import { useState, useEffect, useCallback, useMemo } from 'react'
import type { ColorMode, AppearanceSettings, CustomTheme, ThemeColors, ClaudeAPI } from '../../shared/types'

const DEFAULT_LIGHT: ThemeColors = {
  background: '#ffffff',
  foreground: '#1a1a1a',
  muted: '#6b7280',
  accent: '#3b82f6',
  border: '#e5e7eb',
  sidebar: '#f9fafb',
  panel: '#ffffff',
  itemBg: '#f3f4f6',
  itemHover: '#e5e7eb',
  itemSelected: '#dbeafe',
  codeBg: '#f8f9fc',
  codeBorder: '#e2e6ef',
  codeText: '#374151',
}

const DEFAULT_DARK: ThemeColors = {
  background: '#1e1e2e',
  foreground: '#cdd6f4',
  muted: '#a6adc8',
  accent: '#89b4fa',
  border: '#45475a',
  sidebar: '#181825',
  panel: '#1e1e2e',
  itemBg: '#313244',
  itemHover: '#45475a',
  itemSelected: '#45475a',
  codeBg: '#1a1a2e',
  codeBorder: '#2a2a4a',
  codeText: '#a8b4c8',
}

const COLOR_TO_VAR: Record<keyof ThemeColors, string> = {
  background: '--color-background',
  foreground: '--color-foreground',
  muted: '--color-muted',
  accent: '--color-accent',
  border: '--color-border',
  sidebar: '--color-sidebar',
  panel: '--color-panel',
  itemBg: '--color-item-bg',
  itemHover: '--color-item-hover',
  itemSelected: '--color-item-selected',
  codeBg: '--color-code-bg',
  codeBorder: '--color-code-border',
  codeText: '--color-code-text',
}

export function useTheme(api: ClaudeAPI) {
  const [settings, setSettings] = useState<AppearanceSettings>({ mode: 'system', customTheme: null })
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([])
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  const isDark = useMemo(() => {
    if (settings.mode === 'system') return systemPrefersDark
    return settings.mode === 'dark'
  }, [settings.mode, systemPrefersDark])

  useEffect(() => {
    Promise.all([
      api.app.getAppearanceSettings(),
      api.app.getCustomThemes(),
    ]).then(([loadedSettings, themes]) => {
      setSettings(loadedSettings)
      setCustomThemes(themes)
    })
  }, [api])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', isDark)

    const baseColors = isDark ? DEFAULT_DARK : DEFAULT_LIGHT
    const customTheme = settings.customTheme
      ? customThemes.find(t => t.id === settings.customTheme)
      : null

    let customColors: ThemeColors | undefined
    if (customTheme) {
      const file = customTheme.file
      customColors = file.colors ?? (isDark ? file.dark : file.light)
    }

    for (const [key, varName] of Object.entries(COLOR_TO_VAR)) {
      const colorKey = key as keyof ThemeColors
      const value = customColors?.[colorKey] ?? baseColors[colorKey]
      if (value) {
        root.style.setProperty(varName, value)
      }
    }
  }, [isDark, settings.customTheme, customThemes])

  const updateSettings = useCallback(async (newSettings: Partial<AppearanceSettings>) => {
    const merged = { ...settings, ...newSettings }
    setSettings(merged)
    await api.app.setAppearanceSettings(merged)
  }, [api, settings])

  const importTheme = useCallback(async (sourcePath: string) => {
    const newTheme = await api.app.importTheme(sourcePath)
    setCustomThemes(prev => [...prev, newTheme])
    return newTheme
  }, [api])

  const refreshThemes = useCallback(async () => {
    const themes = await api.app.getCustomThemes()
    setCustomThemes(themes)
  }, [api])

  return {
    settings,
    customThemes,
    isDark,
    updateSettings,
    importTheme,
    refreshThemes,
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/renderer/hooks/useTheme.ts
git commit -m "feat: add useTheme hook"
```

---

## Task 5: Create SettingsModal Component

**Files:**
- Create: `src/renderer/components/SettingsModal.tsx`

**Step 1: Create the component**

```typescript
import { useState } from 'react'
import type { ColorMode, AppearanceSettings, CustomTheme, ClaudeAPI } from '../../shared/types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: AppearanceSettings
  customThemes: CustomTheme[]
  isDark: boolean
  onUpdateSettings: (settings: Partial<AppearanceSettings>) => Promise<void>
  onImportTheme: (sourcePath: string) => Promise<CustomTheme>
  api: ClaudeAPI
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  customThemes,
  isDark,
  onUpdateSettings,
  onImportTheme,
  api,
}: SettingsModalProps) {
  const [importing, setImporting] = useState(false)

  if (!isOpen) return null

  const handleModeChange = (mode: ColorMode) => {
    onUpdateSettings({ mode })
  }

  const handleThemeChange = (themeId: string | null) => {
    onUpdateSettings({ customTheme: themeId })
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const filePath = await api.app.openFile([
        { name: 'Theme Files', extensions: ['json'] }
      ])
      if (filePath) {
        await onImportTheme(filePath)
      }
    } catch (err) {
      console.error('Failed to import theme:', err)
    } finally {
      setImporting(false)
    }
  }

  const modes: { value: ColorMode; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-panel border border-border rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground text-xl leading-none">×</button>
        </div>
        <div className="p-4 space-y-6">
          <section>
            <h3 className="text-sm font-medium text-muted uppercase tracking-wide mb-4">Appearance</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Mode</label>
              <div className="flex gap-1 p-1 bg-item-bg rounded-lg">
                {modes.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => handleModeChange(value)}
                    className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                      settings.mode === value
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Theme</label>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                <button
                  onClick={() => handleThemeChange(null)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-left transition-colors ${
                    settings.customTheme === null ? 'bg-item-selected' : 'bg-item-bg hover:bg-item-hover'
                  }`}
                >
                  <span>Default</span>
                  {settings.customTheme === null && <span className="text-accent">✓</span>}
                </button>
                {customThemes.map(theme => {
                  const supportsCurrentMode = theme.file.colors || (isDark ? theme.file.dark : theme.file.light)
                  return (
                    <button
                      key={theme.id}
                      onClick={() => handleThemeChange(theme.id)}
                      disabled={!supportsCurrentMode}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-left transition-colors ${
                        settings.customTheme === theme.id
                          ? 'bg-item-selected'
                          : supportsCurrentMode ? 'bg-item-bg hover:bg-item-hover' : 'bg-item-bg opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {theme.name}
                        {!supportsCurrentMode && <span className="text-xs text-muted">({isDark ? 'light only' : 'dark only'})</span>}
                      </span>
                      {settings.customTheme === theme.id && <span className="text-accent">✓</span>}
                    </button>
                  )
                })}
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="w-full px-3 py-2 rounded-md text-sm text-left text-muted hover:text-foreground bg-item-bg hover:bg-item-hover transition-colors"
                >
                  {importing ? 'Importing...' : '+ Import Theme'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/renderer/components/SettingsModal.tsx
git commit -m "feat: add SettingsModal component"
```

---

## Task 6: Integrate Settings into App

**Files:**
- Modify: `src/renderer/App.tsx`

**Step 1: Add imports**

```typescript
import { useTheme } from './hooks/useTheme'
import { SettingsModal } from './components/SettingsModal'
```

**Step 2: Add settings state after existing state declarations**

```typescript
  const [settingsOpen, setSettingsOpen] = useState(false)
  const themeState = useTheme(api)
```

**Step 3: Remove old theme state and effects**

Remove:
- `const [theme, setTheme] = useState<Theme>('dark')`
- The `useEffect` with `api.app.getTheme()`
- The `useEffect` with `document.documentElement.classList.toggle`
- The `toggleTheme` callback

**Step 4: Replace theme toggle button with settings gear**

Replace the button in the header:

```typescript
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
```

**Step 5: Add SettingsModal before closing div**

```typescript
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
```

**Step 6: Update mock API**

Add to mockApi's `app` section:

```typescript
    getAppearanceSettings: async () => ({ mode: 'system' as const, customTheme: null }),
    setAppearanceSettings: async () => {},
    getCustomThemes: async () => [
      { id: 'neon-night', name: 'Neon Night', file: { name: 'Neon Night', dark: { background: '#0a0a0f', accent: '#ff00ff' } } }
    ],
    importTheme: async () => ({ id: 'imported', name: 'Imported', file: { name: 'Imported', colors: {} } }),
    openFile: async () => null,
```

**Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 8: Commit**

```bash
git add src/renderer/App.tsx src/renderer/hooks/useTheme.ts
git commit -m "feat: integrate settings modal into app"
```

---

## Task 7: Test and Verify

**Step 1: Build and run**

```bash
npm run dev
```

**Step 2: Manual test checklist**

- [ ] Gear icon in title bar
- [ ] Settings modal opens on click
- [ ] Mode toggle: Light/Dark/System
- [ ] System mode follows OS preference
- [ ] Theme list shows Default and Neon Night
- [ ] Neon Night applies magenta accent in dark mode
- [ ] Default restores original colors
- [ ] Settings persist after app restart
- [ ] Backdrop click closes modal

**Step 3: Commit fixes if needed**

```bash
git add -A
git commit -m "fix: address testing issues"
```

---

## Task 8: Update Bean Status

**Files:**
- Modify: `.beans/settings-and-themes.md`

**Step 1: Update status**

```yaml
status: completed
```

**Step 2: Commit**

```bash
git add .beans/settings-and-themes.md
git commit -m "chore: mark settings-and-themes as completed"
```

---

## Summary

9 tasks implementing:
1. Settings types
2. Theme IPC handlers + neon-night default
3. Preload updates
4. useTheme hook
5. SettingsModal component
6. App integration
7. Testing
8. Bean status update
