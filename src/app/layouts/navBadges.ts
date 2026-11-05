import type { BadgeProps, NavigationMenuItem } from '@nuxt/ui'

/** A quiet count chip on a nav entry (`4`, `99+`), in the warning tone of «pendiente». */
export function navCountBadge(count: number): BadgeProps {
  return {
    label: count > 99 ? '99+' : String(count),
    color: 'warning',
    variant: 'soft',
    size: 'sm',
    class: 'hf-shell-nav-count tabular-nums',
  }
}

/**
 * Decorates nav children whose `to` has a count (`{ '/pos/reembolsos': 4 }`). A count of 0
 * shows nothing; `useSidebar` keeps only the permission-filtered tree.
 */
export function withNavBadges(
  items: NavigationMenuItem[],
  counts: Record<string, number>,
): NavigationMenuItem[] {
  const badgeFor = (to: unknown) => {
    const count = typeof to === 'string' ? (counts[to] ?? 0) : 0
    return count > 0 ? navCountBadge(count) : undefined
  }
  return items.map((item) => ({
    ...item,
    ...(item.children
      ? {
          children: item.children.map((child) => {
            const badge = badgeFor(child.to)
            return badge ? { ...child, badge } : child
          }),
        }
      : {}),
  }))
}
