import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { queryClient } from '@/core/shared/api/queryClient'
import { isRealtimeEnabled, realtimePlugin, getRealtimeService } from '@/core/realtime'
import { abilitiesPlugin } from '@casl/vue'
import ui from '@nuxt/ui/vue-plugin'
import router from '@/app/router'
import { ability } from '@/features/auth/authorization/ability'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { onSessionExpired } from '@/features/auth/services/session-events'
import { startChatbotRealtimeSync } from '@/features/chatbot/requests/realtime/chatbot-realtime-sync'
import { startNotificationsRealtimeSync } from '@/features/notifications/realtime/notifications-realtime-sync'
import App from './App.vue'

// ── Coco dark-first default ───────────────────────────────────────────────────
// The user explicitly chose dark as the default theme. Force dark mode on first
// load; light mode is opt-in via the user menu toggle.
const stored = typeof localStorage !== 'undefined' && localStorage.getItem('vueuse-color-mode')
if (!stored) {
  document.documentElement.classList.add('dark')
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(abilitiesPlugin, ability)
app.use(router)
app.use(ui)
app.use(VueQueryPlugin, { queryClient })

const authStore = useAuthStore(pinia)

// ── Realtime (SSE), behind VITE_REALTIME_SSE (off by default) ─────────────────
// Polling stays the fallback. With the flag off none of this runs: no service, no fetch, no lock.
// The lifecycle (installed after Pinia) only connects a user who has a tenant and
// `read:ChatbotRequest`; the two sync functions patch the query cache from its events.
if (isRealtimeEnabled()) {
  app.use(realtimePlugin)
  const realtime = getRealtimeService()
  startChatbotRealtimeSync({
    client: queryClient,
    service: realtime,
    getTenantId: () => authStore.currentTenantId,
    getUserId: () => authStore.user?.id ?? null,
  })
  startNotificationsRealtimeSync({
    client: queryClient,
    service: realtime,
    getTenantId: () => authStore.currentTenantId,
  })
}

onSessionExpired(() => {
  const currentRoute = router.currentRoute.value
  const isOnLogin = currentRoute.path === '/login'
  const isOnPublicCatalog =
    currentRoute.name === 'public-catalog' || currentRoute.name === 'public-catalog-product'
  const redirectTarget = isOnLogin ? undefined : currentRoute.fullPath

  authStore.clearSession()

  if (!isOnLogin && !isOnPublicCatalog) {
    void router.replace(
      redirectTarget ? { path: '/login', query: { redirect: redirectTarget } } : { path: '/login' },
    )
  }
})

void router.isReady().then(() => {
  app.mount('#app')
})
