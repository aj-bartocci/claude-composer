import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { ThemeFile, CustomTheme } from '../../shared/types'
import { bundledThemes } from './bundled-themes'

const THEMES_DIR = path.join(app.getPath('home'), '.claude-center', 'themes')

async function ensureThemesDir(): Promise<void> {
  await fs.mkdir(THEMES_DIR, { recursive: true })
}

export async function getCustomThemes(): Promise<CustomTheme[]> {
  await ensureThemesDir()

  const userThemes: CustomTheme[] = []

  try {
    const files = await fs.readdir(THEMES_DIR)

    for (const file of files) {
      if (!file.endsWith('.json')) continue

      try {
        const filePath = path.join(THEMES_DIR, file)
        const content = await fs.readFile(filePath, 'utf-8')
        const themeFile: ThemeFile = JSON.parse(content)

        userThemes.push({
          id: file.replace('.json', ''),
          name: themeFile.name,
          file: themeFile,
        })
      } catch {
        // Skip invalid theme files
      }
    }
  } catch {
    // Directory read failed, just return bundled themes
  }

  // Bundled themes first, then user themes
  return [...bundledThemes, ...userThemes]
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
