import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import type { Bean, BeanStatus, BeanPriority } from '../../shared/types'

const BEANS_DIR = '.beans'

/**
 * Check if a .beans directory exists in the project
 */
export async function checkBeansDirectory(projectPath: string): Promise<boolean> {
  try {
    const beansPath = join(projectPath, BEANS_DIR)
    const stats = await stat(beansPath)
    return stats.isDirectory()
  } catch {
    return false
  }
}

/**
 * Parse YAML front matter from markdown content
 */
function parseFrontMatter(content: string): { frontMatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) {
    return { frontMatter: {}, body: content }
  }

  const yamlContent = match[1]
  const body = match[2]
  const frontMatter: Record<string, unknown> = {}

  // Simple YAML parsing for common bean fields
  for (const line of yamlContent.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const key = line.slice(0, colonIdx).trim().toLowerCase()
    let value: unknown = line.slice(colonIdx + 1).trim()

    // Handle quoted strings
    if (typeof value === 'string') {
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      // Handle arrays (tags)
      if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''))
      }
    }

    frontMatter[key] = value
  }

  return { frontMatter, body }
}

/**
 * Parse a single bean markdown file
 */
export async function parseBean(filePath: string): Promise<Bean | null> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const stats = await stat(filePath)
    const { frontMatter, body } = parseFrontMatter(content)

    const id = String(frontMatter.id || filePath.split('/').pop()?.replace('.md', '') || '')
    const status = (frontMatter.status as BeanStatus) || 'draft'

    // Filter out scrapped beans
    if (status === 'scrapped') {
      return null
    }

    const priority = (frontMatter.priority as BeanPriority) || 'normal'
    const title = String(frontMatter.title || id)
    const type = frontMatter.type ? String(frontMatter.type) : undefined
    const tags = Array.isArray(frontMatter.tags)
      ? frontMatter.tags.map(String)
      : typeof frontMatter.tags === 'string'
        ? [frontMatter.tags]
        : []

    return {
      id,
      title,
      status,
      type,
      priority,
      tags,
      body: body.trim(),
      filePath,
      updatedAt: stats.mtimeMs,
    }
  } catch (err) {
    console.error('Failed to parse bean:', filePath, err)
    return null
  }
}

/**
 * Get all beans from a project's .beans directory
 */
export async function getBeans(projectPath: string): Promise<Bean[]> {
  const beansPath = join(projectPath, BEANS_DIR)

  try {
    const files = await readdir(beansPath)
    const mdFiles = files.filter(f => f.endsWith('.md'))

    const beans = await Promise.all(
      mdFiles.map(file => parseBean(join(beansPath, file)))
    )

    // Filter nulls (scrapped beans) and sort by priority then updatedAt
    const priorityOrder: Record<BeanPriority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
      deferred: 4,
    }

    return beans
      .filter((b): b is Bean => b !== null)
      .sort((a, b) => {
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
        if (priorityDiff !== 0) return priorityDiff
        return b.updatedAt - a.updatedAt
      })
  } catch (err) {
    console.error('Failed to get beans:', projectPath, err)
    return []
  }
}
