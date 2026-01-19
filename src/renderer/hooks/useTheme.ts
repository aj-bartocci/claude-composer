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
