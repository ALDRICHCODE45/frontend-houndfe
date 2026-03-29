import { h } from 'vue'
import type { Column } from '@tanstack/vue-table'

/**
 * Creates a sortable column header with a button that toggles sorting.
 * Use inside column definition `header` property.
 *
 * IMPORTANT: `UButton` must be passed in because resolveComponent()
 * can only be called at setup scope.
 *
 * @example
 * ```ts
 * const UButton = resolveComponent('UButton')
 * const columns = [
 *   {
 *     accessorKey: 'name',
 *     header: ({ column }) => createSortableHeader(column, 'Name', UButton),
 *   }
 * ]
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSortableHeader(column: Column<any>, label: string, UButton: any) {
  const isSorted = column.getIsSorted()

  return h(UButton, {
    color: 'neutral',
    variant: 'ghost',
    label,
    trailingIcon: isSorted
      ? isSorted === 'asc'
        ? 'i-lucide-arrow-up-narrow-wide'
        : 'i-lucide-arrow-down-wide-narrow'
      : 'i-lucide-arrow-up-down',
    class: '-mx-2.5',
    onClick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
  })
}

/**
 * Creates a sortable column header with a dropdown menu for sort direction.
 * More advanced — shows Asc/Desc options with checkboxes.
 *
 * @example
 * ```ts
 * const UButton = resolveComponent('UButton')
 * const UDropdownMenu = resolveComponent('UDropdownMenu')
 * const columns = [
 *   {
 *     accessorKey: 'name',
 *     header: ({ column }) => createSortableHeaderDropdown(column, 'Name', UButton, UDropdownMenu),
 *   }
 * ]
 * ```
 */
export function createSortableHeaderDropdown(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: Column<any>,
  label: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UButton: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UDropdownMenu: any,
) {
  const isSorted = column.getIsSorted()

  return h(
    UDropdownMenu,
    {
      content: { align: 'start' },
      items: [
        {
          label: 'Ascendente',
          type: 'checkbox' as const,
          icon: 'i-lucide-arrow-up-narrow-wide',
          checked: isSorted === 'asc',
          onSelect: () =>
            isSorted === 'asc' ? column.clearSorting() : column.toggleSorting(false),
        },
        {
          label: 'Descendente',
          type: 'checkbox' as const,
          icon: 'i-lucide-arrow-down-wide-narrow',
          checked: isSorted === 'desc',
          onSelect: () =>
            isSorted === 'desc' ? column.clearSorting() : column.toggleSorting(true),
        },
      ],
    },
    () =>
      h(UButton, {
        color: 'neutral',
        variant: 'ghost',
        label,
        trailingIcon: isSorted
          ? isSorted === 'asc'
            ? 'i-lucide-arrow-up-narrow-wide'
            : 'i-lucide-arrow-down-wide-narrow'
          : 'i-lucide-arrow-up-down',
        class: '-mx-2.5 data-[state=open]:bg-elevated',
      }),
  )
}
