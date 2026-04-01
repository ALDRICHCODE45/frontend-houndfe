import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { AppAction, AppSubject } from '@/features/auth/interfaces/auth.types'
import { createRouter, createWebHistory } from 'vue-router'

type RoutePermission = [AppAction, AppSubject]

const LoginView = () => import('@/features/auth/login/views/LoginView.vue')
const DashboardHomeView = () => import('@/features/dashboard/home/views/DashboardHomeView.vue')
const ProductsView = () => import('@/features/POS/products/views/ProductsView.vue')
const OrdersView = () => import('@/features/POS/orders/views/OrdersView.vue')
const AdminUsersView = () => import('@/features/admin/users/views/AdminUsersView.vue')
const AdminRolesView = () => import('@/features/admin/roles/views/AdminRolesView.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { layout: 'auth', public: true },
    },
    {
      path: '/',
      name: 'home',
      component: DashboardHomeView,
      meta: { layout: 'dashboard' },
    },
    {
      path: '/pos/products',
      name: 'pos-products',
      component: ProductsView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'Product'] as RoutePermission,
      },
    },
    {
      path: '/pos/orders',
      name: 'pos-orders',
      component: OrdersView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'Order'] as RoutePermission,
      },
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: AdminUsersView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'User'] as RoutePermission,
      },
    },
    {
      path: '/admin/roles',
      name: 'admin-roles',
      component: AdminRolesView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'Role'] as RoutePermission,
      },
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (!authStore.accessToken) {
    authStore.hydrateFromStorage()
  }

  if (authStore.accessToken && !authStore.user) {
    try {
      await authStore.fetchMe()
    } catch {
      authStore.clearSession()
    }
  }

  const isPublic = to.meta.public === true

  if (!isPublic && !authStore.isAuthenticated) {
    return {
      path: '/login',
      query: { redirect: to.fullPath },
    }
  }

  if (authStore.isAuthenticated && !authStore.permissionsLoaded) {
    try {
      await authStore.fetchPermissions()
    } catch {
      authStore.clearSession()

      return {
        path: '/login',
        query: { redirect: to.fullPath },
      }
    }
  }

  if (to.path === '/login' && authStore.isAuthenticated) {
    return '/'
  }

  const requiredPermission = to.meta.permission as RoutePermission | undefined
  if (requiredPermission && !authStore.userCan(requiredPermission[0], requiredPermission[1])) {
    return '/'
  }

  return true
})

export default router
