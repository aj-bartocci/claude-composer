import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import * as os from 'os'

// Map to track active PTY instances by terminalId
const terminals = new Map<string, pty.IPty>()

export interface TerminalSpawnOptions {
  cols?: number
  rows?: number
  cwd?: string
}

/**
 * Spawn a new PTY process using the user's configured shell
 */
export function spawnTerminal(
  mainWindow: BrowserWindow,
  terminalId: string,
  options: TerminalSpawnOptions = {}
): void {
  // Clean up existing terminal with same ID if present
  if (terminals.has(terminalId)) {
    killTerminal(terminalId)
  }

  const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash')
  const cols = options.cols || 80
  const rows = options.rows || 24
  const cwd = options.cwd || os.homedir()

  const ptyProcess = pty.spawn(shell, ['-i'], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      // Disable session restoration that might cause issues
      SHELL_SESSION_DID_INIT: '1',
    } as Record<string, string>,
  })

  terminals.set(terminalId, ptyProcess)

  // Forward PTY data to renderer
  ptyProcess.onData((data) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:data', { terminalId, data })
    }
  })

  // Handle PTY exit
  ptyProcess.onExit(({ exitCode, signal }) => {
    // Only delete from map if this is still the active terminal for this ID
    // (prevents race condition when a new terminal replaces an old one)
    if (terminals.get(terminalId) === ptyProcess) {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal:exit', { terminalId, exitCode, signal })
      }
      terminals.delete(terminalId)
    }
  })
}

/**
 * Write data to a terminal
 */
export function writeToTerminal(terminalId: string, data: string): void {
  const terminal = terminals.get(terminalId)
  if (terminal) {
    terminal.write(data)
  }
}

/**
 * Resize a terminal
 */
export function resizeTerminal(terminalId: string, cols: number, rows: number): void {
  const terminal = terminals.get(terminalId)
  if (terminal) {
    terminal.resize(cols, rows)
  }
}

/**
 * Kill a single terminal
 */
export function killTerminal(terminalId: string): void {
  const terminal = terminals.get(terminalId)
  if (terminal) {
    terminal.kill()
    terminals.delete(terminalId)
  }
}

/**
 * Kill all terminals - call on app close
 */
export function killAllTerminals(): void {
  for (const [id, terminal] of terminals) {
    terminal.kill()
    terminals.delete(id)
  }
}
