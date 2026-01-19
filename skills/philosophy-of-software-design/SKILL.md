---
name: philosophy-of-software-design
description: Use when designing APIs, modules, or interfaces. Use when reviewing code for complexity. Use when choosing between exposing options vs handling internally.
---

# Philosophy of Software Design

Core principle: **Complexity is the enemy. Fight it by creating deep modules with simple interfaces.**

## Deep Modules vs Shallow Modules

```
DEEP MODULE (good)              SHALLOW MODULE (bad)
┌─────────────────────┐         ┌─────────────────────┐
│ parse(path): T[]    │ ←simple │ ParseOptions        │
├─────────────────────┤         │ ParseResult<T>      │
│                     │         │ ParseStats          │
│   file reading      │         │ ParsedLine<T>       │
│   line splitting    │         │ JsonlFileError      │
│   JSON parsing      │         │ JsonlParseError     │ ←complex
│   error handling    │         │ onError modes       │
│   edge cases        │         ├─────────────────────┤
│                     │ ←complex│ (thin impl)         │ ←thin
└─────────────────────┘         └─────────────────────┘
```

**Deep:** Simple interface, rich functionality hidden inside.
**Shallow:** Complex interface that just passes through to implementation.

## The Four Principles

### 1. Pull Complexity Downward

Handle complexity inside the module, not in the caller.

```typescript
// ❌ Pushes complexity up - caller must handle
parse(path, { onError: 'skip' | 'error' | 'include' })

// ✅ Pulls complexity down - module handles it
parse(path): T[]  // silently skips malformed, logs internally
```

### 2. Define Errors Out of Existence

Design APIs so errors can't happen, rather than handling them.

```typescript
// ❌ Exposes error cases to caller
getUser(id): User | null | UserNotFoundError | PermissionError

// ✅ Defines errors away
getUser(id): User  // throws only on true failures, returns sensible default otherwise
```

### 3. Hide Information

Expose what callers need. Hide everything else.

```typescript
// ❌ Leaks internals
{ data: T[], stats: { linesProcessed, errorCount, skippedCount }, rawLines: string[] }

// ✅ Hides internals
T[]  // caller gets what they need, nothing more
```

### 4. Minimize Configuration

Make opinionated choices. Don't punt decisions to callers.

```typescript
// ❌ Caller decides everything
new Parser({ bufferSize, encoding, errorMode, parseMode, strictMode })

// ✅ Module decides sensibly
new Parser()  // smart defaults, maybe one escape hatch if truly needed
```

## Quick Reference

| Smell | Fix |
|-------|-----|
| Many options/flags | Make opinionated choice internally |
| Multiple return types | Return one type, handle variants inside |
| Custom error classes | Use standard errors or define errors away |
| Stats/metadata in response | Only if caller explicitly needs it |
| Discriminated unions | Usually means leaking internal states |
| "Flexible" API | Flexibility = complexity pushed to caller |

## When Designing

Ask: **"Can I make this interface simpler by handling more inside?"**

If the answer is yes, do it. The implementation getting more complex is fine - that's where complexity belongs.

## Red Flags

You're violating PoSD when:
- Interface has more types than methods
- Caller must understand internal states
- "Flexibility" is a selling point
- Options exist "in case someone needs them"
- Return type is a union of success/error shapes
