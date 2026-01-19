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
