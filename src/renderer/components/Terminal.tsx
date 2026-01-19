import { useEffect, useRef, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import type { ClaudeAPI } from '../../shared/types'

interface TerminalProps {
  terminalId: string
  cwd?: string
  api: ClaudeAPI
  onExit?: (exitCode: number) => void
}

export function Terminal({ terminalId, cwd, api, onExit }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const spawnedRef = useRef(false)
  const onExitRef = useRef(onExit)

  // Keep onExit ref current without triggering effect re-runs
  useEffect(() => {
    onExitRef.current = onExit
  }, [onExit])

  // Fit terminal to container
  const fitTerminal = useCallback(() => {
    if (fitAddonRef.current && terminalRef.current) {
      try {
        fitAddonRef.current.fit()
        const { cols, rows } = terminalRef.current
        api.terminal.resize(terminalId, cols, rows)
      } catch {
        // Ignore fit errors during initialization
      }
    }
  }, [api, terminalId])

  useEffect(() => {
    if (!containerRef.current || spawnedRef.current) return

    // Create terminal instance
    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1a1a',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        cursorAccent: '#1a1a1a',
        selectionBackground: '#3b82f6',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
    })

    // Add addons
    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)

    // Open terminal in container
    terminal.open(containerRef.current)
    fitAddon.fit()
    terminal.focus()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    spawnedRef.current = true

    // Spawn PTY
    const cols = terminal.cols
    const rows = terminal.rows
    api.terminal.spawn(terminalId, { cols, rows, cwd })

    // Forward user input to PTY
    const inputDisposable = terminal.onData((data) => {
      api.terminal.write(terminalId, data)
    })

    // Receive PTY output
    const unsubscribeData = api.terminal.onData((event) => {
      if (event.terminalId === terminalId) {
        terminal.write(event.data)
      }
    })

    // Handle PTY exit
    const unsubscribeExit = api.terminal.onExit((event) => {
      if (event.terminalId === terminalId) {
        terminal.write(`\r\n[Process exited with code ${event.exitCode}]\r\n`)
        onExitRef.current?.(event.exitCode)
      }
    })

    // ResizeObserver for container resize
    const resizeObserver = new ResizeObserver(() => {
      fitTerminal()
    })
    resizeObserver.observe(containerRef.current)

    // Cleanup
    return () => {
      inputDisposable.dispose()
      unsubscribeData()
      unsubscribeExit()
      resizeObserver.disconnect()
      api.terminal.kill(terminalId)
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
      spawnedRef.current = false
    }
  }, [terminalId, cwd, api, fitTerminal])

  const handleClick = useCallback(() => {
    terminalRef.current?.focus()
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ backgroundColor: '#1a1a1a' }}
      onClick={handleClick}
    />
  )
}
