import { watch, type Ref } from 'vue'
import { useRouter, useRoute, type LocationQueryRaw } from 'vue-router'
import type { PaginationState, SortingState } from '@tanstack/vue-table'

interface UrlSyncOptions {
  pagination: Ref<PaginationState>
  sorting: Ref<SortingState>
  globalFilter: Ref<string>
  defaultPageSize: number
}

export function useTableUrlSync(options: UrlSyncOptions) {
  const router = useRouter()
  const route = useRoute()

  // Read initial state from URL on mount
  function readFromUrl() {
    const query = route.query

    if (query.page) {
      const page = Number(query.page)
      if (!isNaN(page) && page > 0) {
        options.pagination.value = {
          ...options.pagination.value,
          pageIndex: page - 1, // URL is 1-indexed, TanStack is 0-indexed
        }
      }
    }

    if (query.pageSize) {
      const size = Number(query.pageSize)
      if (!isNaN(size) && size > 0) {
        options.pagination.value = {
          ...options.pagination.value,
          pageSize: size,
        }
      }
    }

    if (query.sort && typeof query.sort === 'string') {
      // Format: "column:asc" or "column:desc"
      const [id, order] = query.sort.split(':')
      if (id) {
        options.sorting.value = [{ id, desc: order === 'desc' }]
      }
    }

    if (query.q && typeof query.q === 'string') {
      options.globalFilter.value = query.q
    }
  }

  // Write state to URL (replaces, doesn't push)
  function writeToUrl() {
    const query: Record<string, string> = {}
    const { pageIndex, pageSize } = options.pagination.value

    if (pageIndex > 0) {
      query.page = String(pageIndex + 1)
    }

    if (pageSize !== options.defaultPageSize) {
      query.pageSize = String(pageSize)
    }

    if (options.sorting.value.length > 0) {
      const sort = options.sorting.value[0]
      if (sort) {
        query.sort = `${sort.id}:${sort.desc ? 'desc' : 'asc'}`
      }
    }

    if (options.globalFilter.value) {
      query.q = options.globalFilter.value
    }

    // Preserve other query params that aren't ours
    const currentQuery = { ...route.query }
    const ourKeys = ['page', 'pageSize', 'sort', 'q']
    const preserved: Record<string, string | string[]> = {}
    for (const [key, value] of Object.entries(currentQuery)) {
      if (!ourKeys.includes(key) && value != null) {
        preserved[key] = value as string | string[]
      }
    }

    router.replace({ query: { ...preserved, ...query } as LocationQueryRaw })
  }

  // Initialize from URL
  readFromUrl()

  // Sync to URL on state changes (debounced to avoid rapid updates)
  let syncTimeout: ReturnType<typeof setTimeout> | null = null
  watch(
    [options.pagination, options.sorting, options.globalFilter],
    () => {
      if (syncTimeout) clearTimeout(syncTimeout)
      syncTimeout = setTimeout(writeToUrl, 100)
    },
    { deep: true },
  )
}
