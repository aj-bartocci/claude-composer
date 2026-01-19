# Settings Page and Custom Themes Design

## Overview

Add a settings page accessible via a gear icon in the title bar. The settings modal allows users to configure custom color themes with support for universal themes or light/dark variants.

## Theme File Format

Theme files are stored in `~/.claude-center/themes/` as JSON files.

### Universal Theme (applies to both modes)

```json
{
  "name": "Mono",
  "colors": {
    "background": "#1a1a1a",
    "foreground": "#ffffff",
    "accent": "#888888"
  }
}
```

### Variant Theme (separate light/dark)

```json
{
  "name": "Corporate",
  "light": {
    "background": "#ffffff",
    "foreground": "#1a1a1a"
  },
  "dark": {
    "background": "#1a1a2e",
    "foreground": "#e0e0e0"
  }
}
```

### Available Tokens

All tokens are optional and fall back to defaults:

| Token | Purpose |
|-------|---------|
| `background` | Main app background |
| `foreground` | Primary text color |
| `muted` | Secondary/dimmed text |
| `accent` | Interactive elements, highlights |
| `border` | Borders and dividers |
| `sidebar` | Sidebar background |
| `panel` | Panel/card backgrounds |

## Settings Modal UI

### Trigger

Gear icon in the app's title bar (top right). Opens a centered modal with backdrop.

### Layout

```
┌─────────────────────────────────────────┐
│  Settings                          [×]  │
├─────────────────────────────────────────┤
│                                         │
│  Appearance                             │
│  ─────────────────────────────────────  │
│                                         │
│  Mode                                   │
│  [Light] [Dark] [System]                │
│                                         │
│  Theme                                  │
│  ┌─────────────────────────────────┐    │
│  │ Default                      ✓  │    │
│  │ Neon Night                      │    │
│  │ [+ Import Theme]                │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

### Behavior

- **Mode toggle:** Light/Dark/System (System follows OS preference)
- **Theme list:** Shows built-in "Default" plus themes from `~/.claude-center/themes/`
- **Import Theme:** Opens file picker to copy a `.json` theme file into themes directory
- **Changes apply immediately** (no save button)

## Settings Storage

Settings saved to `~/.claude-center/settings.json`:

```json
{
  "appearance": {
    "mode": "system",
    "theme": "neon-night"
  }
}
```

- `mode`: "light" | "dark" | "system"
- `theme`: theme id (filename without .json), or `null` for default

## Neon Night Example Theme

Shipped as a bundled example in `~/.claude-center/themes/neon-night.json`:

```json
{
  "name": "Neon Night",
  "dark": {
    "background": "#0a0a0f",
    "foreground": "#e0e0ff",
    "muted": "#7878a0",
    "accent": "#ff00ff",
    "border": "#2a2a3f",
    "sidebar": "#0d0d14",
    "panel": "#12121a"
  }
}
```

Dark-only theme with deep blue-black backgrounds and magenta neon accent.

## Implementation Architecture

### File Structure

```
app/src/
  components/
    SettingsModal.tsx      # Modal UI with theme picker
    SettingsIcon.tsx       # Gear icon button
  hooks/
    useTheme.ts            # Theme state and CSS variable injection
  lib/
    themes.ts              # Theme loading, merging, validation
```

### IPC API Additions

```typescript
app: {
  getAppearanceSettings: () => Promise<AppearanceSettings>
  setAppearanceSettings: (settings: AppearanceSettings) => Promise<void>
  getCustomThemes: () => Promise<CustomTheme[]>
  importTheme: (sourcePath: string) => Promise<void>
}
```

### Refactoring Required

- `SessionsSidebar.tsx` hardcoded colors must be replaced with CSS variables
- Add default CSS variables to `index.css` with light/dark variants
