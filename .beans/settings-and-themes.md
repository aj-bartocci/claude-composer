---
id: settings-and-themes
title: Settings page with custom themes
status: completed
type: feature
priority: high
tags: [ui, theming, settings]
---

# Settings Page with Custom Themes

Add a settings modal with custom theme support, allowing users to define their own color schemes via JSON theme files with universal or light/dark variants.

## Requirements
- Settings modal triggered by gear icon in title bar
- Mode toggle: Light/Dark/System
- Theme picker showing Default plus custom themes from ~/.claude-center/themes/
- Import theme button to add new .json theme files
- Changes apply immediately without save button
- Neon Night example theme bundled
- Theme file format supports universal colors OR light/dark variants
