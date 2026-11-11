import { onScopeDispose, toValue, watch, shallowRef, type MaybeRefOrGetter } from 'vue'

/** Draft filters the probe counts; page and order never change the total. */
export interface CatalogFilterCountParams {
  branchSlug: string | null
  priceListId: string | null
  search: string
  categoryId: string | null
  tokens: string[]
}

export type CatalogFilterCountStatus = 'idle' | 'counting' | 'ready' | 'error'

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

/**
 * `GET /public/catalog/:slug/products?limit=1&…`: the response is read only for `meta.total`, so the
 * probe costs one product instead of a page. (The shared products api has no `limit` option yet;
 * when it does, this builder should move there.)
 */
function probeUrl(params: CatalogFilterCountParams & { branchSlug: string }): string {
  const query: string[] = []
  if (params.priceListId !== null)
    query.push(`priceListId=${encodeURIComponent(params.priceListId)}`)
  if (params.categoryId !== null) query.push(`categoryId=${encodeURIComponent(params.categoryId)}`)
  if (params.search !== '') query.push(`q=${encodeURIComponent(params.search)}`)
  for (const token of params.tokens) query.push(`facet=${encodeURIComponent(token)}`)
  query.push('limit=1')
  return `${apiBase}/public/catalog/${encodeURIComponent(params.branchSlug)}/products?${query.join('&')}`
}

async function fetchTotal(url: string, signal: AbortSignal): Promise<number> {
  const response = await fetch(url, { method: 'GET', credentials: 'omit', signal })
  if (response.status !== 200) throw new Error(`Count probe failed with ${response.status}`)
  const body: unknown = await response.json()
  const total =
    body !== null && typeof body === 'object' && 'meta' in body
      ? (body.meta as { total?: unknown } | null)?.total
      : undefined
  if (typeof total !== 'number' || !Number.isInteger(total) || total < 0)
    throw new Error('Count probe returned no total')
  return total
}

/**
 * Live product count for a draft selection. The first request runs at once; later changes are
 * debounced, the previous request is aborted and a stale answer can never overwrite a newer one.
 * Any failure is `error` (the sheet falls back to a neutral «Ver productos»).
 */
export function useCatalogFilterCount(
  params: MaybeRefOrGetter<CatalogFilterCountParams | null>,
  options: { debounceMs?: number } = {},
) {
  const debounceMs = options.debounceMs ?? 300
  const count = shallowRef<number | null>(null)
  const status = shallowRef<CatalogFilterCountStatus>('idle')
  let timer: ReturnType<typeof setTimeout> | null = null
  let controller: AbortController | null = null
  let first = true

  function cancel() {
    if (timer !== null) clearTimeout(timer)
    timer = null
    controller?.abort()
    controller = null
  }

  async function run(url: string) {
    controller?.abort()
    const current = new AbortController()
    controller = current
    try {
      const total = await fetchTotal(url, current.signal)
      if (controller !== current) return
      count.value = total
      status.value = 'ready'
    } catch {
      if (controller !== current) return
      count.value = null
      status.value = 'error'
    }
  }

  watch(
    () => {
      const value = toValue(params)
      return value === null || value.branchSlug === null
        ? null
        : probeUrl({ ...value, branchSlug: value.branchSlug })
    },
    (url) => {
      cancel()
      if (url === null) {
        count.value = null
        status.value = 'idle'
        return
      }
      status.value = 'counting'
      if (first) {
        first = false
        void run(url)
      } else {
        timer = setTimeout(() => {
          timer = null
          void run(url)
        }, debounceMs)
      }
    },
    { immediate: true },
  )
  onScopeDispose(cancel)

  return { count, status }
}
