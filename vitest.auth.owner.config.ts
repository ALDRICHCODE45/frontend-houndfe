// Isolated Vitest config for the C1 auth slices: no app vite config/env read
// (`envDir: false`), cache off, Vue SFC plugin + `@` alias only. Includes the
// storage + JWT decode specs plus the store/HTTP compatibility specs (those mock
// the storage boundary, so they are not storage integration evidence).
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  envDir: false,
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    root: fileURLToPath(new URL('./', import.meta.url)),
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    cache: false,
    include: [
      'src/features/auth/services/__tests__/auth-storage.spec.ts',
      'src/features/auth/services/__tests__/jwt.utils.spec.ts',
      'src/features/auth/stores/__tests__/useAuthStore.spec.ts',
      'src/core/shared/api/__tests__/http.spec.ts',
    ],
    exclude: ['e2e/**', '**/node_modules/**'],
  },
})
