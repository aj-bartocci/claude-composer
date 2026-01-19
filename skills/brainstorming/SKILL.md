---
name: brainstorming
cascades: superpowers:brainstorming
---

@APPEND

## Bean Creation

After the design is validated and before moving to implementation:

1. **Check if work warrants a bean** - Multi-session work, features, bugs, or refactors should have a bean
2. **Create the bean** in `.beans/<feature-id>.md`:

```markdown
---
id: <feature-id>
title: <short description>
status: todo
type: feature|bug|refactor
priority: normal
tags: [relevant, tags]
---

# <Feature Name>

<What and why - 1-2 sentences>

## Requirements
- Requirement from design
- Another requirement
```

3. **Commit the bean** along with the design document

This ensures work is tracked across sessions before planning begins.
