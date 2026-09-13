import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { queryClient } from '@/core/shared/api/queryClient'
import { abilitiesPlugin } from '@casl/vue'
import ui from '@nuxt/ui/vue-plugin'
import router from '@/app/router'
import { ability } from '@/features/auth/authorization/ability'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { onSessionExpired } from '@/features/auth/services/session-events'
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

onSessionExpired(() => {
  const currentRoute = router.currentRoute.value
  const isOnLogin = currentRoute.path === '/login'
  const isOnPublicCatalog = currentRoute.name === 'public-catalog'
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
