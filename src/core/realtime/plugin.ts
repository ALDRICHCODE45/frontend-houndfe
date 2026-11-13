import type { Plugin } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { startRealtimeLifecycle } from './lifecycle'

/**
 * Optional app plugin: ties the stream to the auth store (login → start,
 * logout / tenant switch → stop / restart). Install it AFTER Pinia:
 *
 *   app.use(pinia)
 *   app.use(realtimePlugin)
 *
 * Inert while `VITE_REALTIME_SSE` is off. Not installed anywhere yet (T4b wires it).
 */
export const realtimePlugin: Plugin = {
  install(app) {
    const auth = app.runWithContext(() => useAuthStore())
    startRealtimeLifecycle(auth)
  },
}
