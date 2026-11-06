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
 * Decorates nav children whose `to` has a count (`{ '/pos/reembolsos': 4 }`), and their group
 * with the sum, so a closed group still shows that something is pending. A count of 0 shows
 * nothing; `useSidebar` keeps only the permission-filtered tree.
 */
export function withNavBadges(
  items: NavigationMenuItem[],
  counts: Record<string, number>,
): NavigationMenuItem[] {
  const countFor = (to: unknown) => (typeof to === 'string' ? (counts[to] ?? 0) : 0)
  return items.map((item) => {
    if (!item.children) return item
    const total = item.children.reduce((sum, child) => sum + countFor(child.to), 0)
    return {
      ...item,
      ...(total > 0 ? { badge: navCountBadge(total) } : {}),
      children: item.children.map((child) => {
        const count = countFor(child.to)
        return count > 0 ? { ...child, badge: navCountBadge(count) } : child
      }),
    }
  })
}
