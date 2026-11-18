/**
 * Dedicated Vite config for the editorial-live journey. Reuses the cash-live hardening builder
 * unchanged (no `.env*` loading, only `VITE_API_BASE_URL` survives from the process env, HMR off,
 * DevTools/Inspector plugins dropped) on top of the real app config, read-only.
 */
import { defineConfig } from 'vite'

import { buildCashLiveViteConfig } from './vite.cash-live.config'

export default defineConfig(async () => {
  const { default: baseConfig } = await import('./vite.config')
  return buildCashLiveViteConfig(baseConfig)
})
