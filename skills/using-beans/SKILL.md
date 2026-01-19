---
name: using-beans
description: Use when starting work on features, bugs, or multi-session tasks - guides bean creation and TodoWrite integration for task tracking
---

# Using Beans for Task Tracking

Beans are markdown files in `.beans/` that track work across sessions. TodoWrite tracks steps within a session. They work together.

## When to Use

- **Create a bean** when starting a feature, bug fix, or work that might span sessions
- **Skip beans** for quick fixes completable in one session

## Bean Format

```markdown
---
id: feature-name
title: Short description
status: todo
type: feature
priority: normal
tags: [ui, search]
---

# Feature Name

What and why.

## Requirements
- Requirement 1
- Requirement 2
```

| Field | Values |
|-------|--------|
| `status` | draft, todo, in-progress, completed, scrapped |
| `priority` | critical, high, normal, low, deferred |
| `type` | feature, bug, refactor, docs (optional) |

## Workflow

1. **Starting work:** Read the bean, update status to `in-progress`
2. **Create TodoWrite items** from the bean's requirements
3. **Reference the bean** in first todo (e.g., "Implement add-search: create search component")
4. **As todos complete:** Progress is visible in both places
5. **All todos done:** Update bean to `completed`

```
Bean: add-search (in-progress)
    ↓
TodoWrite:
  [x] Implement add-search: create search box
  [x] Implement add-search: add debounce
  [ ] Implement add-search: session search
```

## Best Practices

- **One bean per deliverable** - something you could demo or ship
- **Draft liberally** - use `draft` for ideas, `todo` when committed
- **Update body as you work** - add decisions, blockers, notes
- **Scrapped not deleted** - preserves history and reasoning
- **Check beans at session start** - pick up `in-progress` work
