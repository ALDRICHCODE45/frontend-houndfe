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
