import type { ThemeFile, CustomTheme } from '../../shared/types'

const neonNight: ThemeFile = {
  name: 'Neon Night',
  dark: {
    background: '#0a0a0f',
    foreground: '#e0e0ff',
    muted: '#7878a0',
    accent: '#ff00ff',
    border: '#2a2a3f',
    sidebar: '#0d0d14',
    panel: '#12121a',
    itemBg: '#16161f',
    itemHover: '#1f1f2e',
    itemSelected: '#2a1a3a',
    codeBg: '#0c0c12',
    codeBorder: '#2a2a3f',
    codeText: '#c0c0e0',
  },
}

const plus1000: ThemeFile = {
  name: '+1000',
  dark: {
    background: '#0a0a0a',
    foreground: '#f5f5f5',
    muted: '#9ca3af',
    accent: '#D4A420',
    border: '#2a2a2a',
    sidebar: '#000000',
    panel: '#121212',
    itemBg: '#1a1a1a',
    itemHover: '#2a2208',
    itemSelected: '#4a4010',
    codeBg: '#0f0f0f',
    codeBorder: '#2a2a2a',
    codeText: '#FFC72C',
  },
}

export const bundledThemes: CustomTheme[] = [
  { id: 'neon-night', name: neonNight.name, file: neonNight, bundled: true },
  { id: 'plus1000', name: plus1000.name, file: plus1000, bundled: true },
]
