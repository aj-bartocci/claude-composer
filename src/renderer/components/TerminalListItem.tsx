import { useState, useRef, useEffect } from 'react'
import type { TerminalSession } from '../../shared/types'

interface TerminalListItemProps {
  session: TerminalSession
  isActive: boolean
  isEditing: boolean
  onSelect: () => void
  onRemove: () => void
  onStartEdit: () => void
  onRename: (name: string) => void
  onCancelEdit: () => void
}

export function TerminalListItem({
  session,
  isActive,
  isEditing,
  onSelect,
  onRemove,
  onStartEdit,
  onRename,
  onCancelEdit,
}: TerminalListItemProps) {
  const [editValue, setEditValue] = useState(session.name)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Reset edit value when session name changes
  useEffect(() => {
    setEditValue(session.name)
  }, [session.name])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const trimmed = editValue.trim()
      if (trimmed) {
        onRename(trimmed)
      } else {
        onCancelEdit()
      }
    } else if (e.key === 'Escape') {
      setEditValue(session.name)
      onCancelEdit()
    }
  }

  const handleBlur = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== session.name) {
      onRename(trimmed)
    } else {
      setEditValue(session.name)
      onCancelEdit()
    }
  }

  return (
    <div
      onClick={onSelect}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onStartEdit()
      }}
      className={`group flex items-center gap-2 px-2 h-9 rounded cursor-pointer transition-colors ${
        isActive ? 'bg-item-selected' : 'bg-item-bg hover:bg-item-hover'
      }`}
    >
      {/* Status dot */}
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          session.exited ? 'bg-gray-500' : 'bg-green-500'
        }`}
        title={session.exited ? 'Exited' : 'Running'}
      />

      {/* Name / Edit input */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 text-sm bg-transparent border border-accent rounded px-1 outline-none text-foreground"
        />
      ) : (
        <span className="flex-1 text-sm truncate">{session.name}</span>
      )}

      {/* Action buttons (visible on hover, not when editing) */}
      {!isEditing && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onStartEdit()
            }}
            className="text-muted hover:text-foreground text-xs px-1"
            title="Rename"
          >
            Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="text-muted hover:text-red-500 text-lg leading-none"
            title="Remove"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
