/**
 * Isolated Vitest config for the editorial-live support modules (pure validators, seed plan,
 * network audit, evidence writer, config builder, live context). Node environment; does not merge
 * the root Vite config or install global e2e mocks. Never starts a browser, server or HTTP.
 */
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    root: fileURLToPath(new URL('./', import.meta.url)),
    include: ['__tests__/*.spec.ts'],
    setupFiles: [],
  },
})
