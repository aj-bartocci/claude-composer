---
name: iterative-ui-with-playwright
description: Use when building or modifying UI components. Use when you need visual feedback during development. Use when implementing designs incrementally.
---

# Iterative UI Development with Playwright

Core principle: **Build in small increments. Screenshot after each change. Evaluate visually. Adjust. Repeat.**

## The Loop

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ┌──────────┐    ┌────────────┐    ┌────────────┐  │
│  │  Code    │ →  │ Screenshot │ →  │  Evaluate  │  │
│  │  Change  │    │  (View it) │    │  Visually  │  │
│  └──────────┘    └────────────┘    └────────────┘  │
│       ↑                                   │        │
│       │                                   ↓        │
│       │         ┌────────────────────────────┐     │
│       └──────── │  Decide: Done or Adjust?  │     │
│                 └────────────────────────────┘     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**NOT:** Build everything → verify at end
**YES:** Build small → verify → adjust → repeat

## Setup

```typescript
// playwright-check.ts - save to project root
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5173';
const output = process.argv[3] || '/tmp/ui-check.png';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: output, fullPage: false });
  await browser.close();
  console.log(`Screenshot saved: ${output}`);
})();
```

Run with: `npx ts-node playwright-check.ts http://localhost:5173 /tmp/check.png`

## The Process

### 1. Start Small
Don't build the full component. Start with the skeleton:

```typescript
// First iteration - just the container
export function Sidebar() {
  return <div className="w-64 bg-sidebar">Sidebar</div>;
}
```

### 2. Screenshot and View

```bash
npx ts-node playwright-check.ts http://localhost:5173 /tmp/sidebar-1.png
```

Then **read the screenshot** to see what rendered:
```
Read /tmp/sidebar-1.png
```

### 3. Evaluate What You See
Ask yourself:
- Does the container appear?
- Is the width correct?
- Is the background color right?
- What's missing for the next increment?

### 4. Make ONE Adjustment
Add the next small piece:

```typescript
// Second iteration - add header
export function Sidebar() {
  return (
    <div className="w-64 bg-sidebar">
      <h2 className="p-4 font-semibold">Sessions</h2>
    </div>
  );
}
```

### 5. Screenshot Again
```bash
npx ts-node playwright-check.ts http://localhost:5173 /tmp/sidebar-2.png
```

View it. Evaluate. Continue.

## Increment Sizes

**Good increments:**
- Add container with basic styling
- Add header text
- Add one list item (hardcoded)
- Add click handler + selected state
- Add real data

**Bad increments:**
- Build entire component with all features
- Add styling + interaction + data in one go
- "Finish the component"

## When to Screenshot

- After every structural change (new element)
- After styling changes you're unsure about
- After adding interactivity (click something first)
- When something doesn't look right

## Interacting Before Screenshot

For testing interactions:

```typescript
// playwright-check.ts with click
await page.goto(url);
await page.waitForLoadState('networkidle');
await page.click('[data-testid="session-item-0"]'); // Click first item
await page.screenshot({ path: output });
```

## Red Flags

You're not iterating if:
- You write 50+ lines before taking a screenshot
- You "finish" the component then verify
- You don't view the screenshots you take
- You assume it looks right without checking

## Example Session

```
1. Write: Empty sidebar container
   Screenshot → View → "Container visible, needs header"

2. Write: Add "Sessions" header
   Screenshot → View → "Header shows, needs list items"

3. Write: Add one hardcoded session item
   Screenshot → View → "Item shows but spacing is off"

4. Write: Fix padding
   Screenshot → View → "Spacing good, need more items"

5. Write: Add map over sessions array
   Screenshot → View → "All items show, need selected state"

6. Write: Add selected styling + click handler
   Screenshot with click → View → "Selection works, done"
```

Six iterations, six screenshots, six visual confirmations.

## Integration with Development

Keep the dev server running in background:
```bash
npm run dev &
```

Then iterate:
```bash
# Edit code...
npx ts-node playwright-check.ts
# View /tmp/ui-check.png
# Repeat
```

The screenshot becomes your eyes. Trust what you see, not what you think you wrote.
