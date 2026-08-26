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
const SalesListView = () => import('@/features/POS/sales/views/SalesListView.vue')
const SaleDetailView = () => import('@/features/POS/sales/views/SaleDetailView.vue')
const PromotionsView = () => import('@/features/POS/promotions/views/PromotionsView.vue')
const PromotionDetailView = () =>
  import('@/features/POS/promotions/views/PromotionDetailView.vue')
// ─── Quotations module (sdd-quotations-crud S1, REQ-QTN-001) ──────────────────
//
// Three lazy routes, mirroring the sales convention:
//   - list  /pos/cotizaciones       → QuotationsListView  (read:Quotation)
//   - new   /pos/cotizaciones/nueva → QuotationDetailView (read:Quotation — the
//                                        view itself fires createDraft() on
//                                        mount in S4 and redirects to /:id)
//   - id    /pos/cotizaciones/:id   → QuotationDetailView (read:Quotation)
const QuotationsListView = () =>
  import('@/features/POS/quotations/views/QuotationsListView.vue')
const QuotationDetailView = () =>
  import('@/features/POS/quotations/views/QuotationDetailView.vue')
const AdminUsersView = () => import('@/features/admin/users/views/AdminUsersView.vue')
const AdminRolesView = () => import('@/features/admin/roles/views/AdminRolesView.vue')
// ─── Employees module (WU-02, WU-06A, WU-12B) ───────────────────────────────
const EmployeesListView = () =>
  import('@/features/admin/employees/views/EmployeesListView.vue')
const EmployeeDetailView = () =>
  import('@/features/admin/employees/views/EmployeeDetailView.vue')
const ExpiringDocumentsView = () =>
  import('@/features/admin/employees/views/ExpiringDocumentsView.vue')
const PendingApprovalsView = () =>
  import('@/features/admin/employees/views/PendingApprovalsView.vue')
const AdminTenantsView = () => import('@/features/admin/tenants/views/AdminTenantsView.vue')
const AdminTenantMembersView = () =>
  import('@/features/admin/tenants/memberships/views/AdminTenantMembersView.vue')
// sdd payment-details-admin S3 (REQ-PD-007) — route guarded by
// `read:PaymentDetail`. The view is lazy-loaded once the navigation entry
// fires; S3 ships the read-only list, S4 adds the inline mutations + banner.
const AdminPaymentDetailsView = () =>
  import('@/features/admin/payment-details/views/AdminPaymentDetailsView.vue')
// sdd custom-payment-methods S2B (REQ-PM-006) — route guarded by
// `read:PaymentMethod`. Mirrors the PaymentDetails pattern: lazy-loaded on
// navigation; the view is read-only at this slice (S2B) and gains the
// mutation lifecycle + slideover in S3B.
const AdminPaymentMethodsView = () =>
  import('@/features/admin/payment-methods/views/AdminPaymentMethodsView.vue')
const CatalogView = () => import('@/features/catalog/views/CatalogView.vue')
// ─── Notification config (WU-11) ──────────────────────────────────────────
const NotificationConfigView = () =>
  import('@/features/system/notifications/views/NotificationConfigView.vue')
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
      name: 'pos-sales-list',
      component: SalesListView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'Sale'] as RoutePermission,
      },
    },
    {
      path: '/pos/ventas/nueva',
      name: 'pos-sales',
      component: SalesView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'Sale'] as RoutePermission,
      },
    },
    {
      path: '/pos/ventas/:id',
      name: 'pos-sale-detail',
      component: SaleDetailView,
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
    // ─── Quotations routes (sdd-quotations-crud S1, REQ-QTN-001) ───────────────
    {
      path: '/pos/cotizaciones',
      name: 'pos-quotations-list',
      component: QuotationsListView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'Quotation'] as RoutePermission,
      },
    },
    {
      path: '/pos/cotizaciones/nueva',
      name: 'pos-quotations-create',
      component: QuotationDetailView,
      meta: {
        layout: 'dashboard',
        permission: ['create', 'Quotation'] as RoutePermission,
      },
    },
    {
      path: '/pos/cotizaciones/:id',
      name: 'pos-quotation-detail',
      component: QuotationDetailView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'Quotation'] as RoutePermission,
      },
    },
    // ─── Employees routes (WU-02, WU-06A) ──────────────────────────────────────
    {
      path: '/admin/colaboradores',
      name: 'admin-employees-list',
      component: EmployeesListView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'Employee'] as RoutePermission,
      },
    },
    {
      path: '/admin/colaboradores/:id',
      name: 'admin-employee-detail',
      component: EmployeeDetailView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'Employee'] as RoutePermission,
      },
    },
    // ─── Employees dashboard routes (WU-12B) ─────────────────────────────────
    {
      path: '/admin/colaboradores/documentos-vencer',
      name: 'admin-employees-expiring-documents',
      component: ExpiringDocumentsView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'EmployeeDocument'] as RoutePermission,
      },
    },
    {
      path: '/admin/colaboradores/aprobaciones-pendientes',
      name: 'admin-employees-pending-approvals',
      component: PendingApprovalsView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'EmployeeTimeOff'] as RoutePermission,
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
      path: '/admin/tenants/:tenantId/members',
      name: 'admin-tenant-members',
      component: AdminTenantMembersView,
      meta: {
        layout: 'dashboard',
        requiresAuth: true,
        skipTenantCheck: true,
        requiresSuperAdmin: true,
      },
    },
    // ─── Payment-details admin (sdd payment-details-admin S3, REQ-PD-007) ────
    {
      path: '/admin/payment-details',
      name: 'admin-payment-details',
      component: AdminPaymentDetailsView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'PaymentDetail'] as RoutePermission,
      },
    },
    // ─── Payment-methods admin (sdd custom-payment-methods S2B, REQ-PM-006) ──
    // Gated by `read:PaymentMethod` (CASL); mirrors PaymentDetails so the
    // route guard + nav entry stay symmetric. S3B adds the inline mutations
    // + slideover; S2B ships read-only.
    {
      path: '/admin/payment-methods',
      name: 'admin-payment-methods',
      component: AdminPaymentMethodsView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'PaymentMethod'] as RoutePermission,
      },
    },
    // ─── Notification config (WU-11) ──────────────────────────────────────────
    {
      path: '/sistema/configuracion/notificaciones',
      name: 'sistema-notification-config',
      component: NotificationConfigView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'NotificationConfig'] as RoutePermission,
      },
    },
    // ─── Public catalog ─────────────────────────────────────────────────────────
    {
      path: '/catalogo/:branchSlug?',
      name: 'public-catalog',
      component: CatalogView,
      meta: { layout: 'catalog', public: true },
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

  // Allow /select-tenant when the user has a tempToken (multi-tenant login pending selection)
  const hasTenantSelectionToken = authStore.tempToken !== null
  if (!isPublic && !authStore.isAuthenticated && !(to.name === 'select-tenant' && hasTenantSelectionToken)) {
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
