import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import ui from '@nuxt/ui/vue-plugin'
import router from '@/app/router'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { onSessionExpired } from '@/features/auth/services/session-events'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ui)
app.use(VueQueryPlugin)

const authStore = useAuthStore(pinia)
authStore.hydrateFromStorage()

onSessionExpired(() => {
  const isOnLogin = router.currentRoute.value.path === '/login'
  const redirectTarget = isOnLogin ? undefined : router.currentRoute.value.fullPath

  authStore.clearSession()

  if (!isOnLogin) {
    void router.replace(
      redirectTarget ? { path: '/login', query: { redirect: redirectTarget } } : { path: '/login' },
    )
  }
})

app.mount('#app')
