import { getCurrentInstance, nextTick, onBeforeMount, onMounted, watch, type Ref } from 'vue'
import { useRouter, useRoute, type LocationQueryRaw } from 'vue-router'
import type { PaginationState, SortingState } from '@tanstack/vue-table'

interface UrlSyncOptions {
  pagination: Ref<PaginationState>
  sorting: Ref<SortingState>
  globalFilter: Ref<string>
  defaultPageSize: number
  /** The sizes the table offers; a size in the URL outside them is ignored. */
  pageSizeOptions?: readonly number[]
}

export function useTableUrlSync(options: UrlSyncOptions) {
  // The URL needs a component with a router; without them (a bare effect scope, a component
  // mounted without the router) the table simply keeps its state in memory.
  if (!getCurrentInstance()) return
  const router = useRouter()
  const route = useRoute()
  if (!router || !route) return

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
      const offered = !options.pageSizeOptions || options.pageSizeOptions.includes(size)
      if (!isNaN(size) && size > 0 && offered) {
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
  const sortingBefore = options.sorting.value
  readFromUrl()
  const urlPageIndex = options.pagination.value.pageIndex
  const urlSorting = options.sorting.value !== sortingBefore ? options.sorting.value : undefined

  // A link wins over what the rest of the setup applies on first load (owner-ideas-batch S6): a
  // saved view reopening sets its own sorting after the table read the URL, and that sorting
  // change, filter or status watchers reset the page in the first flush. The sorting goes back
  // before that flush; the page goes back once it is over.
  onBeforeMount(() => {
    if (urlSorting) options.sorting.value = urlSorting
  })
  onMounted(() =>
    nextTick(() => {
      if (urlPageIndex > 0 && options.pagination.value.pageIndex !== urlPageIndex) {
        options.pagination.value = { ...options.pagination.value, pageIndex: urlPageIndex }
      }
    }),
  )

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
