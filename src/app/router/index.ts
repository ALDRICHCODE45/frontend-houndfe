import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { AppAction, AppSubject } from '@/features/auth/interfaces/auth.types'
import { defineComponent } from 'vue'
import { createRouter, createWebHistory, type RouteMeta } from 'vue-router'
import {
  isRememberableLandingLocation,
  resolveLandingDestination,
  resolveRememberedLandingPath,
  ROOT_PATH,
  ROOT_ROUTE_NAME,
  type LandingRouteFacts,
  type LandingRouteMeta,
} from '@/app/navigation/navigation.landing'
import { buildCanAccess, type CanAccess } from '@/app/navigation/navigation.access'
import {
  clearRememberedLanding,
  readRememberedLanding,
  writeRememberedLanding,
} from '@/app/navigation/navigation.memory'

import { canReadEditorial } from '@/features/POS/products/authorization/editorial-access'

type RoutePermission = [AppAction, AppSubject]

// Resolver-only root route: the global guard always redirects it (replace) to
// the remembered destination or the permission-aware default. It renders
// nothing, so a redirect can never flash the NotFound view while auth state is
// still hydrating.
const RootRedirectView = defineComponent({
  name: 'RootRedirectView',
  render: () => null,
})

const LoginView = () => import('@/features/auth/login/views/LoginView.vue')
const TenantSelectionView = () =>
  import('@/features/auth/tenant-selection/views/TenantSelectionView.vue')
const ProductsView = () => import('@/features/POS/products/views/ProductsView.vue')
const ProductDetailView = () => import('@/features/POS/products/views/ProductDetailView.vue')
const CustomersView = () => import('@/features/POS/customers/views/CustomersView.vue')
// ─── Cash register / Caja (cash-register-ui T2–T4, S1 subset) ────────────────
// Single "Caja" route guarded by read:CashRegister: registers, session opening,
// manual movements, blind freeze/count, append-only notes, independent
// verification, recipient custody discovery, explicit FLOAT and drawer release.
// Out of scope here: sales binding, refunds, closing/PDF.
const CashRegisterView = () => import('@/features/POS/cash-register/views/CashRegisterView.vue')
const CashReceptionView = () => import('@/features/POS/cash-register/views/CashReceptionView.vue')
const SalesView = () => import('@/features/POS/sales/views/SalesView.vue')
const SalesListView = () => import('@/features/POS/sales/views/SalesListView.vue')
const SaleDetailView = () => import('@/features/POS/sales/views/SaleDetailView.vue')
// T19: pending refunds and their devoluciones (handoff 06). Its own path, so the Ventas
// item does not light up and `/pos/ventas/:id` never captures it.
const PendingRefundsView = () => import('@/features/POS/refunds/views/PendingRefundsView.vue')
// ODD human-decisions-restock-inbox: production shell plus explicitly gated offline demo.
const HumanDecisionsView = () =>
  import.meta.env.DEV && import.meta.env.VITE_HUMAN_DECISIONS_OFFLINE_DEMO === 'true'
    ? import('@/features/POS/human-decisions/views/HumanDecisionsOfflineDemoRouteView.vue')
    : import('@/features/POS/human-decisions/views/HumanDecisionsView.vue')
// Chatbot request inbox (T2.U1): list at /chatbot/solicitudes, detail as the email deep link.
const ChatbotRequestsView = () => import('@/features/chatbot/requests/views/ChatbotRequestsView.vue')
const ChatbotRequestDetailView = () =>
  import('@/features/chatbot/requests/views/ChatbotRequestDetailView.vue')
// «Mi perfil» (chatbot-requests-inbox T3.N2): for every authenticated user, no permission.
const ProfileView = () => import('@/features/profile/views/ProfileView.vue')
const PromotionsView = () => import('@/features/POS/promotions/views/PromotionsView.vue')
const PromotionDetailView = () => import('@/features/POS/promotions/views/PromotionDetailView.vue')
// ─── Quotations module (sdd-quotations-crud S1, REQ-QTN-001) ──────────────────
//
// Three lazy routes, mirroring the sales convention:
//   - list  /pos/cotizaciones       → QuotationsListView  (read:Quotation)
//   - new   /pos/cotizaciones/nueva → QuotationDetailView (read:Quotation — the
//                                        view itself fires createDraft() on
//                                        mount in S4 and redirects to /:id)
//   - id    /pos/cotizaciones/:id   → QuotationDetailView (read:Quotation)
const QuotationsListView = () => import('@/features/POS/quotations/views/QuotationsListView.vue')
const QuotationDetailView = () => import('@/features/POS/quotations/views/QuotationDetailView.vue')
const AdminUsersView = () => import('@/features/admin/users/views/AdminUsersView.vue')
const AdminRolesView = () => import('@/features/admin/roles/views/AdminRolesView.vue')
// ─── Employees module (WU-02, WU-06A, WU-12B) ───────────────────────────────
const EmployeesListView = () => import('@/features/admin/employees/views/EmployeesListView.vue')
const EmployeeDetailView = () => import('@/features/admin/employees/views/EmployeeDetailView.vue')
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
// sdd delivery-routes S4c (REQ-DRM-001..007) — manager list view. The detail
// route's lazy const (DeliveryRouteDetailView) ships in S6a; `pnpm build` no
// longer fails on the detail route.
const DeliveryRoutesListView = () =>
  import('@/features/delivery-routes/views/DeliveryRoutesListView.vue')
// sdd delivery-routes S6a — manager-branch detail view (driver branch is a
// placeholder until S6b; the placeholder returns null in the view body).
const DeliveryRouteDetailView = () =>
  import('@/features/delivery-routes/views/DeliveryRouteDetailView.vue')
const CatalogView = () => import('@/features/catalog/views/CatalogView.vue')
const CatalogProductView = () => import('@/features/catalog/views/CatalogProductView.vue')
// ─── Notification config (WU-11) ──────────────────────────────────────────
const NotificationConfigView = () =>
  import('@/features/system/notifications/views/NotificationConfigView.vue')
// ─── Online catalog backoffice (WU3A, REQ-3/REQ-4) ───────────────────────
// Tenant-scoped Sistema route guarded by read:TenantCatalogSettings;
// no skipTenantCheck / requiresSuperAdmin. Read-only at WU3A; WU3B
// layers the editable form + confirmation modal on the same route.
const TenantCatalogSettingsView = () =>
  import('@/features/system/catalog-settings/views/TenantCatalogSettingsView.vue')
// ─── Chatbot settings (ODD chatbot-requests-inbox T5.S) ──────────────────
// Tenant-scoped Sistema route guarded by read:ChatbotSettings; editing and «Aplicar a todas»
// are gated inside the view (update:ChatbotSettings, update:ChatbotSettingsAllBranches).
const ChatbotSettingsView = () =>
  import('@/features/system/chatbot-settings/views/ChatbotSettingsView.vue')
// ─── Shipping settings (ODD shipping-settings T1, S2) ─────────────────────
// Envíos keeps its tab in the query (?tab=zonas|cajas|origen|horario); the
// zone validations queue has its own entry, guarded by validate:DeliveryZone.
const ShippingSettingsView = () =>
  import('@/features/shipping/shipping-settings/views/ShippingSettingsView.vue')
const ZoneValidationsView = () =>
  import('@/features/shipping/delivery-zones/views/ZoneValidationsView.vue')
// ─── Branch sales summary (ODD branch-sales-summary A3d) ─────────────────
// Analytics route guarded by read:Analytics; no skipTenantCheck /
// requiresSuperAdmin. The view is lazy-loaded on navigation.
const BranchSalesSummaryView = () => import('@/features/analytics/views/BranchSalesSummaryView.vue')
const ForbiddenView = () => import('@/features/errors/views/ForbiddenView.vue')
const NotFoundView = () => import('@/features/errors/views/NotFoundView.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // ODD root-last-route: explicit named root route. It is not public and not
    // a tenant-skip route, so the global guard resolves it only after auth
    // hydration, user, tenant and permission readiness.
    {
      path: ROOT_PATH,
      name: ROOT_ROUTE_NAME,
      component: RootRedirectView,
      meta: { layout: 'auth' },
    },
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
    // ODD dashboard-analytics D1: the "/" route was removed entirely; it is
    // neither an application route nor an alias for /dashboard. Direct
    // navigation to "/" now falls through to the catch-all NotFoundView.
    {
      path: '/pos/products',
      name: 'pos-products',
      component: ProductsView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
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
      path: '/pos/products/:id/editorial',
      name: 'pos-product-editorial',
      component: () => import('@/features/POS/products/views/ProductEditorialView.vue'),
      meta: { layout: 'dashboard', editorialRead: true },
    },
    {
      path: '/pos/customers',
      name: 'pos-customers',
      component: CustomersView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
        permission: ['read', 'Customer'] as RoutePermission,
      },
    },
    // ─── Cash register / Caja (cash-register-ui T2, S1 subset) ───────────────

    {
      path: '/pos/caja',
      name: 'pos-cash-register',
      component: CashRegisterView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
        permission: ['read', 'CashRegister'] as RoutePermission,
      },
    },
    {
      path: '/pos/caja/recepciones',
      name: 'pos-cash-reception',
      component: CashReceptionView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
        permission: ['read', 'CashHandover'] as RoutePermission,
      },
    },
    {
      path: '/pos/ventas',
      name: 'pos-sales-list',
      component: SalesListView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
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
      path: '/pos/reembolsos',
      name: 'pos-refunds',
      component: PendingRefundsView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
        permission: ['read', 'SaleRefund'] as RoutePermission,
      },
    },
    // ─── Chatbot request inbox (chatbot-requests-inbox T2.U1) ────────────────
    {
      path: '/chatbot/solicitudes',
      name: 'chatbot-requests',
      component: ChatbotRequestsView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
        permission: ['read', 'ChatbotRequest'] as RoutePermission,
      },
    },
    {
      path: '/chatbot/solicitudes/:id',
      name: 'chatbot-request-detail',
      component: ChatbotRequestDetailView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'ChatbotRequest'] as RoutePermission,
      },
    },
    // ─── Mi perfil (chatbot-requests-inbox T3.N2, S4) ────────────────────────
    // Account data and notification preferences of the signed-in person (handoff 13 §3: no CASL
    // permission). Deliberately without `permission` meta and without `rememberAsLanding`: it is
    // not a work area to land on. The user menu links to it by route name `profile`.
    {
      path: '/perfil',
      name: 'profile',
      component: ProfileView,
      meta: { layout: 'dashboard' },
    },
    // ─── Pending human decisions (ODD human-decisions-restock-inbox HD3A) ────
    // Kept without a nav entry until the BE backfill (handoff 12 §5); the redirect is an owner decision.
    {
      path: '/pos/decisiones-pendientes',
      name: 'pos-human-decisions',
      component: HumanDecisionsView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
        permission: ['read', 'HumanDecision'] as RoutePermission,
      },
    },
    {
      path: '/pos/promociones',
      name: 'pos-promotions',
      component: PromotionsView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
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
        rememberAsLanding: true,
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
        rememberAsLanding: true,
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
        rememberAsLanding: true,
        permission: ['read', 'EmployeeDocument'] as RoutePermission,
      },
    },
    {
      path: '/admin/colaboradores/aprobaciones-pendientes',
      name: 'admin-employees-pending-approvals',
      component: PendingApprovalsView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
        permission: ['read', 'EmployeeTimeOff'] as RoutePermission,
      },
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: AdminUsersView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
        permission: ['read', 'User'] as RoutePermission,
      },
    },
    {
      path: '/admin/roles',
      name: 'admin-roles',
      component: AdminRolesView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
        permission: ['read', 'Role'] as RoutePermission,
      },
    },
    {
      path: '/admin/tenants',
      name: 'admin-tenants',
      component: AdminTenantsView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
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
    {
      path: '/procurement/purchase-orders',
      name: 'procurement-purchase-orders',
      component: () => import('@/features/procurement/purchase-orders/views/PurchaseOrderView.vue'),
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
        permission: ['read', 'ProcurementPurchaseOrder'] as RoutePermission,
      },
    },
    {
      path: '/procurement/suppliers',
      name: 'procurement-suppliers',
      component: () => import('@/features/procurement/suppliers/views/SupplierView.vue'),
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
        permission: ['read', 'ProcurementSupplier'] as RoutePermission,
      },
    },
    // ─── Payment-details admin (sdd payment-details-admin S3, REQ-PD-007) ────
    {
      path: '/admin/payment-details',
      name: 'admin-payment-details',
      component: AdminPaymentDetailsView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
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
        rememberAsLanding: true,
        permission: ['read', 'PaymentMethod'] as RoutePermission,
      },
    },
    // ─── Delivery-routes (sdd delivery-routes S1a, REQ-AUTH-DR-005) ─────
    // Two lazy routes on the same shared read guard. The view
    // discriminates manager vs driver internally — see design §9.2. Views
    // are not yet implemented (S4c / S6a). This slice is accepted to fail
    // `pnpm build` ONLY on the two missing route components.
    {
      path: '/pos/rutas-de-entrega',
      name: 'pos-delivery-routes-list',
      component: DeliveryRoutesListView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
        permission: ['read', 'DeliveryRoute'] as RoutePermission,
      },
    },
    {
      path: '/pos/rutas-de-entrega/:id',
      name: 'pos-delivery-route-detail',
      component: DeliveryRouteDetailView,
      meta: {
        layout: 'dashboard',
        permission: ['read', 'DeliveryRoute'] as RoutePermission,
      },
    },
    // ─── Notification config (WU-11) ──────────────────────────────────────────
    {
      path: '/sistema/configuracion/notificaciones',
      name: 'sistema-notification-config',
      component: NotificationConfigView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
        permission: ['read', 'NotificationConfig'] as RoutePermission,
      },
    },
    // ─── Online catalog backoffice (WU3A, REQ-4) ────────────────────────────
    {
      path: '/system/catalog-settings',
      name: 'system-catalog-settings',
      component: TenantCatalogSettingsView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
        permission: ['read', 'TenantCatalogSettings'] as RoutePermission,
      },
    },
    // ─── Chatbot settings (ODD chatbot-requests-inbox T5.S) ──────────────────
    {
      path: '/sistema/atencion-chatbot',
      name: 'chatbot-settings',
      component: ChatbotSettingsView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
        permission: ['read', 'ChatbotSettings'] as RoutePermission,
      },
    },
    // ─── Shipping settings (ODD shipping-settings T1, S2) ────────────────────
    {
      path: '/sistema/envios',
      name: 'sistema-shipping',
      component: ShippingSettingsView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
        permission: ['read', 'ShippingSettings'] as RoutePermission,
      },
    },
    {
      path: '/sistema/envios/validaciones',
      name: 'sistema-zone-validations',
      component: ZoneValidationsView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
        permission: ['validate', 'DeliveryZone'] as RoutePermission,
      },
    },
    // ─── Dashboard (ODD dashboard-analytics D1) ─────────────────────────────
    // Sole Dashboard/Analytics destination. Until D2 composes the visual
    // dashboard home, /dashboard renders the committed BranchSalesSummaryView
    // so the route already exposes real backend-backed content. The exact
    // read:Analytics gate repeats in nav and resolver.
    {
      path: '/dashboard',
      name: 'dashboard',
      component: BranchSalesSummaryView,
      meta: {
        layout: 'dashboard',
        rememberAsLanding: true,
        permission: ['read', 'Analytics'] as RoutePermission,
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
      // The path the backend share redirect uses for one product of a branch catalog.
      path: '/catalogo/:branchSlug/p/:productId',
      name: 'public-catalog-product',
      component: CatalogProductView,
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

/** Read the access/landing flags off vue-router's loosely typed metadata. */
function toLandingRouteMeta(meta: RouteMeta): LandingRouteMeta {
  return {
    permission: meta.permission as LandingRouteMeta['permission'],
    requiresSuperAdmin: meta.requiresSuperAdmin === true,
    public: meta.public === true,
    rememberAsLanding: meta.rememberAsLanding === true,
  }
}

/** Canonical facts for a candidate remembered path, or null when unmatched. */
function resolveLandingRouteFacts(path: string): LandingRouteFacts | null {
  const resolved = router.resolve(path)
  if (typeof resolved.name !== 'string' || resolved.matched.length === 0) return null

  return {
    canonicalPath: resolved.path,
    meta: toLandingRouteMeta(resolved.meta),
    dynamicParams: Object.keys(resolved.params),
  }
}

/**
 * Resolve the destination for a root visit: the remembered stable route for
 * this (user, tenant) scope when it is still eligible, else the permission-aware
 * default. An unusable record is invalidated instead of being left behind.
 */
function resolveRootLandingTarget(
  authStore: ReturnType<typeof useAuthStore>,
  canAccess: CanAccess,
): string {
  const scope = {
    userId: authStore.user?.id,
    tenantId: authStore.currentTenant?.id,
  }

  const memory = readRememberedLanding(scope)
  const remembered = resolveRememberedLandingPath(memory.path, resolveLandingRouteFacts, canAccess)
  if (remembered !== null) return remembered

  if (memory.hasRecord) clearRememberedLanding(scope)

  return resolveLandingDestination(canAccess)
}

router.beforeEach(async (to) => {
  if (to.name === 'public-catalog' || to.name === 'public-catalog-product') return true

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
  if (
    !isPublic &&
    !authStore.isAuthenticated &&
    !(to.name === 'select-tenant' && hasTenantSelectionToken)
  ) {
    // ODD root-last-route: an unauthenticated root visit is not a deep link, so
    // it must not add a `redirect=/` query — login stays the plain entry point.
    if (to.name === ROOT_ROUTE_NAME) {
      return { path: '/login' }
    }

    return {
      path: '/login',
      query: { redirect: to.fullPath },
    }
  }

  const hasOperationalTenantContext = authStore.currentTenant !== null

  // Global mode is presentation eligibility only on the existing editorial route.
  // Initial login still selects a tenant; operational/root routes never use this exception.
  const hasGlobalEditorialContext = to.meta.editorialRead === true &&
    authStore.isSuperAdmin === true && authStore.authPhase === 'authenticated'

  if (authStore.isAuthenticated && requiresTenantScopedContext && !hasOperationalTenantContext && !hasGlobalEditorialContext) {
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

  const canAccess = buildCanAccess(authStore)

  if (to.name === ROOT_ROUTE_NAME) {
    // ODD root-last-route: "/" resolves only after auth hydration, user, tenant
    // and permission readiness. Restore the remembered destination for this
    // (user, tenant) scope when it is still a stable opted-in route the
    // identity may enter; otherwise fall back to the permission-aware default.
    // Always replace, so root never grows the history stack.
    return { path: resolveRootLandingTarget(authStore, canAccess), replace: true }
  }

  if (to.path === '/login' && authStore.isAuthenticated) {
    // ODD dashboard-analytics D1: authenticated /login redirect now resolves
    // the first permitted application destination via the shared resolver
    // instead of hardcoding "/". Permissions are guaranteed loaded above.
    return resolveLandingDestination(canAccess)
  }

  if (to.meta.requiresSuperAdmin === true && !authStore.isSuperAdmin) {
    return '/403'
  }

  // Feature-local opt-in, only after the existing authentication/tenant hydration.
  // Editorial policy is independent of CASL/operational Product access.
  // A selected tenant remains authoritative even for a global administrator.
  if (to.meta.editorialRead === true &&
    (!authStore.isAuthenticated || authStore.authPhase !== 'authenticated' ||
      !authStore.user?.id || (!authStore.currentTenant?.id && authStore.isSuperAdmin !== true) || !authStore.permissionsLoaded ||
      !canReadEditorial(authStore.permissionCodes, authStore.isSuperAdmin))) {
    return '/403'
  }

  const requiredPermission = to.meta.permission as RoutePermission | undefined
  if (requiredPermission && !authStore.userCan(requiredPermission[0], requiredPermission[1])) {
    return '/403'
  }

  return true
})

router.afterEach((to, _from, failure) => {
  // A failed, aborted, cancelled or duplicated navigation never commits, so it
  // must never rewrite the remembered destination.
  if (failure) return

  // A guard-redirected navigation (root resolution, the authenticated /login
  // redirect, an error redirect) commits successfully with `redirectedFrom`
  // pointing at the location the user actually requested. Those are automatic
  // landings: they must never overwrite the stable section the user chose
  // directly. Only a direct, committed navigation may update memory.
  if (to.redirectedFrom) return

  const rememberable = isRememberableLandingLocation({
    path: to.path,
    name: typeof to.name === 'string' ? to.name : null,
    meta: toLandingRouteMeta(to.meta),
    dynamicParams: Object.keys(to.params),
  })
  if (!rememberable) return

  const authStore = useAuthStore()
  writeRememberedLanding(
    { userId: authStore.user?.id, tenantId: authStore.currentTenant?.id },
    to.path,
  )
})

export default router
