import type { NavAction, NavGroup } from './navigation.types'

/**
 * Single source of truth for the app module tree.
 *
 * Both the sidebar (`useSidebar`) and the command palette (`useDashboard`)
 * derive their navigation from this registry, so adding a module here makes it
 * appear in both places automatically. Keep this file PURE data — no Vue, no
 * store imports.
 */
export const navigationGroups: NavGroup[] = [
  {
    id: 'pos',
    label: 'POS',
    icon: 'i-lucide-shopping-cart',
    defaultOpen: true,
    children: [
      { id: 'pos-sales', label: 'Ventas', icon: 'i-lucide-shopping-cart', to: '/pos/ventas', permission: ['read', 'Sale'] },
      { id: 'pos-products', label: 'Productos', icon: 'i-lucide-package', to: '/pos/products', permission: ['read', 'Product'] },
      { id: 'pos-orders', label: 'Órdenes', icon: 'i-lucide-receipt', to: '/pos/orders', permission: ['read', 'Order'] },
      { id: 'pos-customers', label: 'Clientes', icon: 'i-lucide-users', to: '/pos/customers', permission: ['read', 'Customer'] },
      { id: 'pos-promotions', label: 'Promociones', icon: 'i-lucide-tag', to: '/pos/promociones', permission: ['read', 'Promotion'] },
    ],
  },
  {
    id: 'rrhh',
    label: 'RR.HH.',
    icon: 'i-lucide-users-round',
    defaultOpen: true,
    children: [
      { id: 'rrhh-colaboradores', label: 'Colaboradores', icon: 'i-lucide-user-check', to: '/admin/colaboradores', permission: ['read', 'Employee'] },
      { id: 'rrhh-vencimientos', label: 'Vencimientos', icon: 'i-lucide-file-clock', to: '/admin/colaboradores/documentos-vencer', permission: ['read', 'EmployeeDocument'] },
      { id: 'rrhh-aprobaciones', label: 'Aprobaciones', icon: 'i-lucide-calendar-check', to: '/admin/colaboradores/aprobaciones-pendientes', permission: ['read', 'EmployeeTimeOff'] },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: 'i-lucide-shield-check',
    defaultOpen: true,
    children: [
      { id: 'admin-users', label: 'Usuarios', icon: 'i-lucide-users', to: '/admin/users', permission: ['read', 'User'] },
      { id: 'admin-roles', label: 'Roles', icon: 'i-lucide-user-cog', to: '/admin/roles', permission: ['read', 'Role'] },
      { id: 'admin-tenants', label: 'Sucursales', icon: 'i-lucide-building-2', to: '/admin/tenants', requiresSuperAdmin: true },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    icon: 'i-lucide-settings',
    defaultOpen: true,
    children: [
      { id: 'sistema-notificaciones', label: 'Notificaciones', icon: 'i-lucide-bell', to: '/sistema/configuracion/notificaciones', permission: ['read', 'NotificationConfig'] },
    ],
  },
]

/** Create-shortcuts rendered in the command palette "Acciones" group. */
export const quickActions: NavAction[] = [
  { id: 'new-product', label: 'Nuevo Producto', icon: 'i-lucide-plus', to: '/pos/products/new', permission: ['create', 'Product'] },
  { id: 'new-order', label: 'Nueva Orden', icon: 'i-lucide-plus', to: '/pos/orders/new', permission: ['create', 'Order'] },
  { id: 'new-sale', label: 'Nueva Venta', icon: 'i-lucide-receipt-text', to: '/pos/ventas/nueva', permission: ['read', 'Sale'] },
  { id: 'new-customer', label: 'Nuevo Cliente', icon: 'i-lucide-user-plus', to: '/pos/customers', permission: ['create', 'Customer'] },
  { id: 'new-promotion', label: 'Nueva Promoción', icon: 'i-lucide-percent', to: '/pos/promociones', permission: ['create', 'Promotion'] },
  { id: 'new-employee', label: 'Nuevo Colaborador', icon: 'i-lucide-user-plus', to: '/admin/colaboradores', permission: ['create', 'Employee'] },
]
