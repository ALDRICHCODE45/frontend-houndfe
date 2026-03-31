// Centralized query keys — ALL module query keys defined here
// NEVER define query keys locally in hooks/composables

export const productQueryKeys = {
  paginated: () => ['products', 'paginated'] as const,
  detail: (productId: string) => ['products', 'detail', productId] as const,
}

export const orderQueryKeys = {
  paginated: () => ['orders', 'paginated'] as const,
  detail: (orderId: string) => ['orders', 'detail', orderId] as const,
}

export const authQueryKeys = {
  me: () => ['auth', 'me'] as const,
}

export const adminUserQueryKeys = {
  paginated: () => ['admin', 'users', 'paginated'] as const,
  detail: (userId: string) => ['admin', 'users', 'detail', userId] as const,
}

export const adminRoleQueryKeys = {
  paginated: () => ['admin', 'roles', 'paginated'] as const,
  detail: (roleId: string) => ['admin', 'roles', 'detail', roleId] as const,
  permissions: () => ['admin', 'permissions', 'grouped'] as const,
}
