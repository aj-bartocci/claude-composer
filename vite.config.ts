import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

const isMockMode = process.env.MOCK_MODE === 'true'

export default defineConfig({
  plugins: [
    react(),
    // Skip Electron plugins in mock mode (browser-only with mock data)
    ...(!isMockMode ? [electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: ['electron', 'electron-store', 'chokidar', 'node-pty'],
            },
          },
        },
      },
      {
        entry: 'src/preload/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            lib: {
              entry: 'src/preload/index.ts',
              formats: ['cjs'],
              fileName: () => 'index.js',
            },
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
        onstart(args) {
          args.reload()
        },
      },
    ]), renderer()] : []),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  root: '.',
  build: {
    outDir: 'dist',
  },
})
