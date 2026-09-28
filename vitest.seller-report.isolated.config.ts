/**
 * Isolated Vitest configuration for the seller sales report slice.
 *
 * Why it exists: the seller report slice must run its specs without loading the
 * application Vite config and without any of its side effects. This config
 * therefore:
 *
 * - never imports `vite.config.ts`;
 * - sets `envDir: false`, so no `.env*` file is ever read into the test process;
 * - registers only the Vue SFC plugin, the Nuxt UI plugin with `dts: false` (so
 *   no `components.d.ts` / `auto-imports.d.ts` regeneration ever happens), and
 *   the `@` alias;
 * - disables the Vitest results cache (`cache: false`);
 * - keeps the committed `./vitest.setup.ts` as the only setup file.
 *
 * Why the Nuxt UI plugin is still required: `AdminUsersView.test.ts` and the
 * Vue component specs render the REAL Nuxt UI + Reka UI components (the
 * `@nuxt/ui` module mock is inert for template auto-imports, and `mountWithUApp`
 * resolves `@nuxt/ui/runtime/components/App.vue`, which imports `#imports`).
 * Without the plugin those components cannot be resolved by Vite, so the specs
 * would fail for reasons unrelated to the code under test. The plugin is
 * registered with the generated-declaration output disabled.
 *
 * Run it with the installed local runner (never `npx`):
 *
 * ```
 * node_modules/.bin/vitest run --config vitest.seller-report.isolated.config.ts --no-file-parallelism
 * ```
 */
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'

export default defineConfig({
  envDir: false,
  plugins: [vue(), ui({ dts: false })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    root: fileURLToPath(new URL('./', import.meta.url)),
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    cache: false,
    include: [
      'src/features/admin/users/seller-report/**/__tests__/*.spec.ts',
      'src/features/admin/users/views/__tests__/AdminUsersView.test.ts',
      // The shared HTTP interceptor spec is included because the report PDF
      // request opts into a bounded blob-error read in that interceptor. It is
      // standalone-compatible: it mocks its own transport/adapter and never asks
      // this config to load the application Vite config or an `.env*` file.
      'src/core/shared/api/__tests__/http.spec.ts',
    ],
    exclude: ['e2e/**', '**/node_modules/**'],
  },
})
