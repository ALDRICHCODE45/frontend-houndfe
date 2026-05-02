import { QueryClient } from '@tanstack/vue-query'

/**
 * Shared QueryClient instance.
 *
 * Exported here so non-composable contexts (Pinia stores, interceptors)
 * can access the same instance that is registered with VueQueryPlugin in main.ts.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 0,
    },
  },
})
