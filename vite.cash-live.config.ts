/**
 * Dedicated Vite config for the isolated cash-live journey.
 *
 * It reuses the real app config (`vite.config.ts`) read-only through
 * `mergeConfig`, then hardens only the dev-server surface:
 *
 * - `envDir: false` stops every ambient `.env*` file from being read before
 *   Vite resolves its env. In the installed Vite typings this is the supported
 *   `UserConfig` switch; `envFile?: false` exists only on the deprecated
 *   `InlineConfig` and is deliberately not used here.
 * - Process-env inheritance is sanitized separately because `envDir: false`
 *   does NOT stop Vite from copying inherited `VITE_*` variables into
 *   `import.meta.env`. Only the explicit allowlist
 *   (`CASH_LIVE_VITE_ALLOWED_ENV`) survives; every other `VITE_*` is deleted
 *   from `process.env` before Vite resolves its env.
 * - HMR is disabled and the bundled Vue DevTools/Inspector plugins are
 *   dropped, without touching the rest of the app config.
 *
 * The Vite config function runs before `resolveConfig()` calls `loadEnv()`, so
 * mutating `process.env` here removes ambient values before they can reach the
 * client. This file never starts a server by itself.
 */
import { defineConfig, mergeConfig, type PluginOption, type UserConfig } from 'vite'

/**
 * The only `VITE_*` variable the cash-live client may see: the explicitly
 * declared local backend base URL injected by the Playwright webServer.
 */
export const CASH_LIVE_VITE_ALLOWED_ENV: readonly string[] = ['VITE_API_BASE_URL']

/** Dev-only tooling plugins dropped from the cash-live dev server. */
export const CASH_LIVE_DISABLED_PLUGIN_NAMES: readonly string[] = [
  'vite-plugin-vue-devtools',
  'vite-plugin-vue-inspector',
  'vite-plugin-inspect',
]

/**
 * Deletes every inherited `VITE_*` variable that is not on the allowlist.
 * Mutates `env` in place and returns the removed keys (for evidence/tests).
 */
export function sanitizeCashLiveProcessEnv(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const removed: string[] = []
  for (const key of Object.keys(env)) {
    if (key.startsWith('VITE_') && !CASH_LIVE_VITE_ALLOWED_ENV.includes(key)) {
      delete env[key]
      removed.push(key)
    }
  }
  return removed
}

function isDisabledPlugin(plugin: unknown): boolean {
  if (!plugin || typeof plugin !== 'object') return false
  const name = (plugin as { name?: unknown }).name
  if (typeof name !== 'string') return false
  return CASH_LIVE_DISABLED_PLUGIN_NAMES.some(
    (disabled) => name === disabled || name.startsWith(`${disabled}:`),
  )
}

/** Flattens Vite's nested `PluginOption[]` so devtools plugins can be filtered. */
function flattenPlugins(plugins: readonly unknown[]): unknown[] {
  return plugins.flatMap((plugin) => (Array.isArray(plugin) ? flattenPlugins(plugin) : [plugin]))
}

function withoutDisabledPlugins(plugins: unknown[] | undefined): PluginOption[] {
  return flattenPlugins(plugins ?? []).filter(
    (plugin) => !isDisabledPlugin(plugin),
  ) as PluginOption[]
}

/**
 * Builds the hardened cash-live Vite config from a base config and an env
 * source. Pure apart from the explicit `sanitizeCashLiveProcessEnv(env)` call
 * on the provided (default `process.env`) object.
 */
export function buildCashLiveViteConfig(
  baseConfig: UserConfig,
  env: Record<string, string | undefined> = process.env,
): UserConfig {
  sanitizeCashLiveProcessEnv(env)

  const merged = mergeConfig(baseConfig, {
    envDir: false,
    server: { hmr: false },
  }) as UserConfig

  merged.plugins = withoutDisabledPlugins(merged.plugins)
  return merged
}

export default defineConfig(async () => {
  const { default: baseConfig } = await import('./vite.config')
  return buildCashLiveViteConfig(baseConfig)
})
