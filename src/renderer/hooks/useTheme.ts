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
    const customTheme = settings.customTheme
      ? customThemes.find(t => t.id === settings.customTheme)
      : null

    // For themes that only support one mode, use that mode's colors regardless of current mode
    let effectiveColors: ThemeColors | undefined
    let effectiveDark = isDark

    if (customTheme) {
      const file = customTheme.file
      if (file.colors) {
        effectiveColors = file.colors
      } else if (isDark && file.dark) {
        effectiveColors = file.dark
      } else if (!isDark && file.light) {
        effectiveColors = file.light
      } else if (file.dark && !file.light) {
        // Dark-only theme: use dark colors and force dark mode
        effectiveColors = file.dark
        effectiveDark = true
      } else if (file.light && !file.dark) {
        // Light-only theme: use light colors and force light mode
        effectiveColors = file.light
        effectiveDark = false
      }
    }

    root.classList.toggle('dark', effectiveDark)
    const baseColors = effectiveDark ? DEFAULT_DARK : DEFAULT_LIGHT

    for (const [key, varName] of Object.entries(COLOR_TO_VAR)) {
      const colorKey = key as keyof ThemeColors
      const value = effectiveColors?.[colorKey] ?? baseColors[colorKey]
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
