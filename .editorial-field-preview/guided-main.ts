import { createApp, nextTick } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { useAuthStore } from '../src/features/auth/stores/useAuthStore'
import { http } from '../src/core/shared/api/http'
import { updateAbilityFromPermissionCodes } from '../src/features/auth/authorization/ability'
import ProductDetailView from '../src/features/POS/products/views/ProductDetailView.vue'
import ProductEditorialView from '../src/features/POS/products/views/ProductEditorialView.vue'
import Preview from './GuidedPreview.vue'
import '../src/assets/main.css'
import '../src/core/shared/design-system/houndfe-theme.css'
document.body.classList.add('hf-theme')
const pinia = createPinia()
const router = createRouter({ history: createMemoryHistory(), routes: [
  { path: '/pos/products/create', component: ProductDetailView },
  { path: '/pos/products/:id/editorial', component: ProductEditorialView },
  { path: '/pos/products/:id', component: ProductDetailView },
] })
const app = createApp(Preview)
app.use(pinia)
app.use(VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }) })
const auth = useAuthStore(pinia)
const token = (tenant: string, actor: string) => ['eyJhbGciOiJub25lIn0', btoa(JSON.stringify({ sub: actor, tenantId: tenant, isSuperAdmin: false, exp: 4102444800 })), 'synthetic'].join('.')
function scope(tenant = 'fixture-tenant', actor = 'fixture-user') {
  const accessToken = token(tenant, actor)
  http.defaults.headers.common.Authorization = `Bearer ${accessToken}`
  auth.$patch({ accessToken, authPhase: 'authenticated',
    user: { id: actor, name: 'Fixture', email: 'fixture@example.invalid', isActive: true, createdAt: '2026-01-01' },
    currentTenant: { id: tenant, name: 'Fixture', slug: 'fixture' },
    permissionsLoaded: true, permissionCodes: ['manage:all'] })
  updateAbilityFromPermissionCodes(auth.permissionCodes)
}
scope()
http.defaults.baseURL = '/guided-fixture-api'
app.use(router)
await router.push(new URLSearchParams(location.search).get('target') || '/pos/products/product-1')
await router.isReady()
app.mount('#app')
// Isolated host controls only: never persisted and never imported by production.
declare global {
  interface Window {
    __guided: { scope: (tenant: string, actor: string) => Promise<void>; revoke: () => Promise<void> }
  }
}
window.__guided = {
  scope: async (tenant: string, actor: string) => { scope(tenant, actor); await nextTick() },
  revoke: async () => {
    auth.permissionCodes = ['read:Product']
    updateAbilityFromPermissionCodes(auth.permissionCodes)
    await nextTick()
  },
}
