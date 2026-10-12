/**
 * Isolated Vitest config for verified cash-live contract and auth-seed specs.
 *
 * Pure validators and the config builder use Node; auth-seed opts into jsdom
 * through its docblock. Does not merge the root Vite config or install global
 * e2e mocks. Independently verified standalone guard and evidence specs are
 * included; the obsolete combined spec remains excluded.
 */
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const here = fileURLToPath(new URL('./', import.meta.url))

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('../../src/', import.meta.url)) },
  },
  test: {
    environment: 'node',
    root: here,
    include: [
      '__tests__/env.spec.ts',
      '__tests__/fixture.spec.ts',
      '__tests__/auth-seed.spec.ts',
      '__tests__/config.spec.ts',
      '__tests__/outbound-guard.spec.ts',
      '__tests__/evidence.spec.ts',
      '__tests__/live-context.spec.ts',
    ],
    setupFiles: [],
  },
})
