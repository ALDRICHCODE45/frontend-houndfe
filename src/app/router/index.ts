import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { AppAction, AppSubject } from '@/features/auth/interfaces/auth.types'
import { createRouter, createWebHistory } from 'vue-router'

type RoutePermission = [AppAction, AppSubject]

const LoginView = () => import('@/features/auth/login/views/LoginView.vue')
const TenantSelectionView = () =>
  import('@/features/auth/tenant-selection/views/TenantSelectionView.vue')
const DashboardHomeView = () => import('@/features/dashboard/home/views/DashboardHomeView.vue')
const ProductsView = () => import('@/features/POS/products/views/ProductsView.vue')
const ProductDetailView = () => import('@/features/POS/products/views/ProductDetailView.vue')
const OrdersView = () => import('@/features/POS/orders/views/OrdersView.vue')
const CustomersView = () => import('@/features/POS/customers/views/CustomersView.vue')
const SalesView = () => import('@/features/POS/sales/views/SalesView.vue')
const PromotionsView = () => import('@/features/POS/promotions/views/PromotionsView.vue')
const PromotionDetailView = () =>
  import('@/features/POS/promotions/views/PromotionDetailView.vue')
const AdminUsersView = () => import('@/features/admin/users/views/AdminUsersView.vue')
const AdminRolesView = () => import('@/features/admin/roles/views/AdminRolesView.vue')
const AdminTenantsView = () => import('@/features/admin/tenants/views/AdminTenantsView.vue')
const ForbiddenView = () => import('@/features/errors/views/ForbiddenView.vue')
const NotFoundView = () => import('@/features/errors/views/NotFoundView.vue')

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
      path: '/select-tenant',
      name: 'select-tenant',
      component: TenantSelectionView,
      meta: { layout: 'auth', requiresAuth: true, skipTenantCheck: true },
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
      path: '/pos/products/new',
      name: 'pos-product-create',
      component: ProductDetailView,
      meta: {
        layout: 'dashboard',
        permission: ['create', 'Product'] as RoutePermission,
      },
    },
    {
      path: '/pos/products/:id',
      name: 'pos-product-detail',
      component: ProductDetailView,
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
      path: '/pos/customers',
      name: 'pos-customers',
      component: CustomersView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'Customer'] as RoutePermission,
      },
    },
    {
      path: '/pos/ventas',
      name: 'pos-sales',
      component: SalesView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'Sale'] as RoutePermission,
      },
    },
    {
      path: '/pos/promociones',
      name: 'pos-promotions',
      component: PromotionsView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'Promotion'] as RoutePermission,
      },
    },
    {
      path: '/pos/promociones/crear/:type',
      name: 'pos-promotion-create',
      component: PromotionDetailView,
      meta: {
        layout: 'dashboard',
        permission: ['create', 'Promotion'] as RoutePermission,
      },
    },
    {
      path: '/pos/promociones/:id',
      name: 'pos-promotion-detail',
      component: PromotionDetailView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'Promotion'] as RoutePermission,
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
    {
      path: '/admin/tenants',
      name: 'admin-tenants',
      component: AdminTenantsView,
      meta: {
        layout: 'dashboard',
        requiresAuth: true,
        skipTenantCheck: true,
        requiresSuperAdmin: true,
      },
    },
    {
      path: '/403',
      name: 'forbidden',
      component: ForbiddenView,
      meta: { layout: 'auth', public: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundView,
      meta: { layout: 'auth', public: true },
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
  const skipTenantCheck = to.meta.skipTenantCheck === true
  const requiresTenantScopedContext = !isPublic && !skipTenantCheck

  if (!isPublic && !authStore.isAuthenticated) {
    return {
      path: '/login',
      query: { redirect: to.fullPath },
    }
  }

  const hasOperationalTenantContext = authStore.currentTenant !== null

  if (authStore.isAuthenticated && requiresTenantScopedContext && !hasOperationalTenantContext) {
    return { name: 'select-tenant' }
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

  if (to.meta.requiresSuperAdmin === true && !authStore.isSuperAdmin) {
    return '/403'
  }

  const requiredPermission = to.meta.permission as RoutePermission | undefined
  if (requiredPermission && !authStore.userCan(requiredPermission[0], requiredPermission[1])) {
    return '/403'
  }

  return true
})

export default router
