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
  const [showExample, setShowExample] = useState(false)

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
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-medium">Theme</label>
                <button
                  onClick={() => setShowExample(!showExample)}
                  className="text-xs px-2 py-0.5 rounded bg-item-bg hover:bg-item-hover text-muted hover:text-foreground transition-colors"
                >
                  {showExample ? 'Hide Example' : 'Example'}
                </button>
              </div>
              {showExample && (
                <div className="mb-3 p-3 bg-code-bg border border-code-border rounded-md text-xs font-mono text-code-text overflow-x-auto">
                  <pre>{`{
  "name": "My Theme",
  "light": {
    "background": "#ffffff",
    "foreground": "#1a1a1a",
    "accent": "#3b82f6"
  },
  "dark": {
    "background": "#0a0a0a",
    "foreground": "#fafafa",
    "accent": "#60a5fa"
  }
}`}</pre>
                  <p className="mt-2 text-muted font-sans text-xs">
                    Save as .json and import. Use "colors" instead of light/dark for a universal theme.
                  </p>
                </div>
              )}
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
