import { readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { Project } from '../../shared/types'

const CLAUDE_DIR = join(homedir(), '.claude')
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects')

/**
 * Decode a Claude project directory name to the original path.
 * Claude encodes paths by replacing '/' with '-' and prepending drive info.
 * Example: "-Users-aj-Developer-JS-claude-center" -> "/Users/aj/Developer/JS/claude-center"
 *
 * Since dashes in folder names conflict with the path separator encoding,
 * we try different interpretations and check which path actually exists.
 */
export function decodeProjectPath(dirName: string): string {
  if (!dirName.startsWith('-')) {
    return dirName.replace(/-/g, '/')
  }

  const parts = dirName.slice(1).split('-')

  // Try combining parts from the end to handle dashes in folder names
  // combineCount: how many parts from the end to join with '-' instead of '/'
  for (let combineCount = 0; combineCount <= parts.length - 1; combineCount++) {
    const splitPoint = parts.length - combineCount
    const pathParts = parts.slice(0, splitPoint)
    const combinedPart = parts.slice(splitPoint).join('-')

    let candidate = '/' + pathParts.join('/')
    if (combinedPart) {
      candidate += '-' + combinedPart
    }

    if (existsSync(candidate)) {
      return candidate
    }
  }

  // Fallback to naive decoding if no path exists
  return '/' + dirName.slice(1).replace(/-/g, '/')
}

/**
 * Extract display name from full path (last segment).
 */
function getDisplayName(fullPath: string): string {
  const segments = fullPath.split('/').filter(Boolean)
  return segments[segments.length - 1] || fullPath
}

export async function getAllProjects(): Promise<Project[]> {
  const projects: Project[] = []

  try {
    const projectDirs = await readdir(PROJECTS_DIR)

    for (const dirName of projectDirs) {
      const projectDir = join(PROJECTS_DIR, dirName)
      const indexPath = join(projectDir, 'sessions-index.json')

      try {
        // First try sessions-index.json
        const indexStat = await stat(indexPath)
        const rootPath = decodeProjectPath(dirName)

        projects.push({
          id: dirName,
          name: getDisplayName(rootPath),
          rootPath,
          lastActivity: indexStat.mtimeMs,
        })
      } catch {
        // No sessions-index.json, check for .jsonl session files directly
        try {
          const files = await readdir(projectDir)
          const sessionFiles = files.filter(f =>
            f.endsWith('.jsonl') && !f.startsWith('agent-')
          )

          if (sessionFiles.length > 0) {
            // Get the most recent session file's mtime
            let latestMtime = 0
            for (const file of sessionFiles) {
              const fileStat = await stat(join(projectDir, file))
              if (fileStat.mtimeMs > latestMtime) {
                latestMtime = fileStat.mtimeMs
              }
            }

            const rootPath = decodeProjectPath(dirName)
            projects.push({
              id: dirName,
              name: getDisplayName(rootPath),
              rootPath,
              lastActivity: latestMtime,
            })
          }
        } catch {
          // Can't read directory, skip
        }
      }
    }
  } catch {
    // Projects dir doesn't exist
  }

  // Sort by most recent activity first
  return projects.sort((a, b) => b.lastActivity - a.lastActivity)
}
