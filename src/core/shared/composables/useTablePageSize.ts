import { ref, watch, type Ref } from 'vue'
import {
  MOBILE_DEFAULT_PAGE_SIZE,
  MOBILE_TABLE_MEDIA_QUERY,
  TABLE_PAGE_SIZE_OPTIONS,
  nearestPageSize,
} from '../constants/table-page-size'

/**
 * The page size a table remembers (odd/tasks/page-size-memory.md S3), next to its column layout:
 * the same browser storage and the same `persistKey`, in its own entry so «Restablecer columnas»
 * never forgets it. Like the layout (`table-preferences-<persistKey>`), it is per browser, not per
 * user or tenant.
 */
export const pageSizeStorageKey = (persistKey: string) => `table-page-size-${persistKey}`

/** The stored size of the table, or `undefined` when there is none or it is not one of `options`. */
export function readStoredPageSize(
  persistKey: string,
  options: readonly number[] = TABLE_PAGE_SIZE_OPTIONS,
): number | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const text = localStorage.getItem(pageSizeStorageKey(persistKey))
    const size: unknown = text === null ? undefined : JSON.parse(text)
    return typeof size === 'number' && options.includes(size) ? size : undefined
  } catch {
    return undefined
  }
}

/** Stores the size when it is one of `options`; anything else is ignored. */
export function writeStoredPageSize(
  persistKey: string,
  size: number,
  options: readonly number[] = TABLE_PAGE_SIZE_OPTIONS,
): void {
  if (typeof window === 'undefined' || !options.includes(size)) return
  try {
    localStorage.setItem(pageSizeStorageKey(persistKey), JSON.stringify(size))
  } catch {
    // Storage full or unavailable
  }
}

/** The viewport is a phone (below md). False where `matchMedia` does not exist (SSR, jsdom). */
function isPhoneViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(MOBILE_TABLE_MEDIA_QUERY).matches
}

/**
 * The size a table starts at when nothing else (stored size, URL) says otherwise: the table's
 * default on desktop, `MOBILE_DEFAULT_PAGE_SIZE` on a phone (mobile-tables S4), as one of `options`.
 */
export function defaultPageSizeForViewport(
  defaultPageSize: number,
  options: readonly number[] = TABLE_PAGE_SIZE_OPTIONS,
): number {
  return isPhoneViewport() ? nearestPageSize(MOBILE_DEFAULT_PAGE_SIZE, options) : defaultPageSize
}

/** The size a table starts at: the stored one, else the default for this viewport. */
export function initialPageSize({
  persistKey,
  defaultPageSize,
  options = TABLE_PAGE_SIZE_OPTIONS,
}: TablePageSizeOptions): number {
  return readStoredPageSize(persistKey, options) ?? defaultPageSizeForViewport(defaultPageSize, options)
}

interface TablePageSizeOptions {
  persistKey: string
  defaultPageSize: number
  /** The sizes the table offers; a stored size outside them falls back to the default. */
  options?: readonly number[]
}

/**
 * A page size ref that starts at the stored size (or the default) and stores every change. For
 * tables that keep their own pagination; `useServerTable` reads and writes the same entry itself.
 */
export function useTablePageSize({
  persistKey,
  defaultPageSize,
  options = TABLE_PAGE_SIZE_OPTIONS,
}: TablePageSizeOptions): { pageSize: Ref<number> } {
  const pageSize = ref(initialPageSize({ persistKey, defaultPageSize, options }))
  watch(pageSize, (size) => writeStoredPageSize(persistKey, size, options), { flush: 'sync' })
  return { pageSize }
}
