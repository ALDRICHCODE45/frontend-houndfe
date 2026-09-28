/**
 * Isolated Vitest configuration for the root remembered-landing slice.
 *
 * Why it exists: the root resolver/persistence slice must run its specs without
 * loading the application Vite config (`vite.config.ts`) and without any of its
 * side effects. This config therefore:
 *
 * - never imports `vite.config.ts`;
 * - sets `envDir: false`, so no `.env*` file is ever read into the test process;
 * - registers only the Vue SFC plugin, the Nuxt UI plugin with `dts: false` (so
 *   no `components.d.ts` / `auto-imports.d.ts` regeneration ever happens), and
 *   the `@` alias;
 * - disables the Vitest results cache (`cache: false`);
 * - keeps the committed `./vitest.setup.ts` as the only setup file;
 * - includes exactly the router root, navigation landing/memory/access and
 *   error-home specs that make up this regression, so no unrelated module is
 *   pulled in and no external HTTP/auth-refresh path is exercised.
 *
 * Why the Nuxt UI plugin is required: the error-home specs mount the real
 * `ForbiddenView` / `NotFoundView` inside `<UApp>`, and `mountWithUApp`
 * resolves `@nuxt/ui/runtime/components/App.vue`, which imports `#imports`.
 * Without the plugin those components cannot be resolved by Vite. The plugin is
 * registered with the generated-declaration output disabled.
 *
 * Run it with the installed local runner (never `npx`):
 *
 * ```
 * node_modules/.bin/vitest run --config vitest.navigation.isolated.config.ts --no-file-parallelism
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
      'src/app/navigation/__tests__/navigation.landing.spec.ts',
      'src/app/navigation/__tests__/navigation.memory.spec.ts',
      'src/app/navigation/__tests__/navigation.access.spec.ts',
      'src/app/router/__tests__/router.spec.ts',
      'src/app/router/__tests__/router.analytics.spec.ts',
      'src/features/errors/views/__tests__/*.spec.ts',
    ],
    exclude: ['e2e/**', '**/node_modules/**'],
  },
})
