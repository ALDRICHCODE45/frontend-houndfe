/**
 * The page sizes every table offers (odd/tasks/page-size-memory.md S2): 5 to 50 in steps of 5.
 * AppDataTable, DataTablePagination and useServerTable default to it; a table passes its own list
 * only when it has a real reason to.
 */
export const TABLE_PAGE_SIZE_OPTIONS: readonly number[] = Object.freeze([5, 10, 15, 20, 25, 30, 35, 40, 45, 50])

/** `size` when it is one of `options`, else the nearest option (the lower one on a tie). */
export function nearestPageSize(size: number, options: readonly number[] = TABLE_PAGE_SIZE_OPTIONS): number {
  if (options.includes(size) || options.length === 0) return size
  return options.reduce((best, option) =>
    Math.abs(option - size) < Math.abs(best - size) ? option : best,
  )
}
