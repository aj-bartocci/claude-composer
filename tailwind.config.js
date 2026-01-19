/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/renderer/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        muted: 'var(--color-muted)',
        accent: 'var(--color-accent)',
        border: 'var(--color-border)',
        sidebar: 'var(--color-sidebar)',
        panel: 'var(--color-panel)',
        'item-bg': 'var(--color-item-bg)',
        'item-hover': 'var(--color-item-hover)',
        'item-selected': 'var(--color-item-selected)',
        'code-bg': 'var(--color-code-bg)',
        'code-border': 'var(--color-code-border)',
        'code-text': 'var(--color-code-text)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
