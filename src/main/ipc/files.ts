import { readFile, readdir, stat, writeFile } from 'fs/promises'
import { join, extname, basename } from 'path'
import type { FileNode } from '../../shared/types'

const MARKDOWN_EXTENSIONS = ['.md', '.mdx', '.markdown']
const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', '.cache']

export async function getFileTree(rootPath: string): Promise<FileNode[]> {
  return buildFileTree(rootPath, rootPath)
}

async function buildFileTree(currentPath: string, rootPath: string): Promise<FileNode[]> {
  const nodes: FileNode[] = []

  try {
    const entries = await readdir(currentPath, { withFileTypes: true })

    for (const entry of entries) {
      // Skip specific ignored directories
      if (IGNORE_DIRS.includes(entry.name)) continue

      const fullPath = join(currentPath, entry.name)

      if (entry.isDirectory()) {
        const children = await buildFileTree(fullPath, rootPath)
        // Only include directories that have markdown files (directly or nested)
        if (children.length > 0) {
          nodes.push({
            name: entry.name,
            path: fullPath,
            type: 'directory',
            children,
          })
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase()
        if (MARKDOWN_EXTENSIONS.includes(ext)) {
          nodes.push({
            name: entry.name,
            path: fullPath,
            type: 'file',
          })
        }
      }
    }
  } catch {
    // Directory doesn't exist or permission denied
  }

  // Sort: directories first, then alphabetically
  return nodes.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1
    if (b.type === 'directory' && a.type !== 'directory') return 1
    return a.name.localeCompare(b.name)
  })
}

export async function getFileContent(filePath: string): Promise<string> {
  try {
    // Verify it's a markdown file
    const ext = extname(filePath).toLowerCase()
    if (!MARKDOWN_EXTENSIONS.includes(ext)) {
      return ''
    }

    // Check file exists and is not too large
    const fileStat = await stat(filePath)
    if (fileStat.size > 1024 * 1024) {
      return '# File too large\n\nThis file exceeds 1MB and cannot be previewed.'
    }

    return await readFile(filePath, 'utf-8')
  } catch {
    return ''
  }
}

export async function saveFileContent(filePath: string, content: string): Promise<void> {
  // Verify it's a markdown file
  const ext = extname(filePath).toLowerCase()
  if (!MARKDOWN_EXTENSIONS.includes(ext)) {
    throw new Error('Only markdown files can be saved')
  }

  await writeFile(filePath, content, 'utf-8')
}
