/**
 * Creates a simple non-sortable column header.
 * Use inside column definition `header` property for columns without sorting.
 *
 * @example
 * ```ts
 * const columns = [
 *   {
 *     accessorKey: 'sku',
 *     header: createSimpleHeader('SKU'),
 *   }
 * ]
 * ```
 */
export function createSimpleHeader(label: string) {
  return () => label
}
