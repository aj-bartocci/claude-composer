/// <reference types="vite/client" />

import type { ClaudeAPI } from '../shared/types'

declare global {
  interface Window {
    claude: ClaudeAPI
  }
}

export {}
