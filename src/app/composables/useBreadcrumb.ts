import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { navigationGroups } from '@/app/navigation/navigation.registry'
import { DASHBOARD_PATH } from '@/app/navigation/navigation.landing'

/**
 * Minimal first-level breadcrumb item. Compatible with Nuxt UI `<UBreadcrumb>`.
 * The module group is rendered as non-interactive context; the section is the
 * active (last) item and carries its own `to`.
 */
export interface BreadcrumbItem {
  label: string
  to?: string
}

/**
 * Derives a two-level "Módulo / Sección" breadcrumb from the current route.
 *
 * Sources of truth: the shared navigation registry (`navigationGroups`) plus the
 * active route path. Because the sidebar and command palette already derive from
 * that registry, the breadcrumb stays consistent with them and needs no manual
 * label map.
 *
 * Matching rules:
 * - `/dashboard` (or empty) → single item `Dashboard` targeting `/dashboard`.
 *   The previous home route "/" was removed (ODD D1) so it is no longer a
 *   breadcrumb target.
 * - A child whose `to` is an exact match or a path-prefix of the current route
 *   (covers sub-routes like `/:id`, `/nueva`, `/crear/:type`). When several
 *   children match, the most specific (longest `to`) wins, so e.g.
 *   `/admin/colaboradores/documentos-vencer` resolves to `RR.HH. / Vencimientos`
 *   and not to the shorter `RR.HH. / Colaboradores`.
 * - No match → fallback to `Dashboard` targeting `/dashboard`.
 */
export const useBreadcrumb = () => {
  const route = useRoute()

  const breadcrumb = computed<BreadcrumbItem[]>(() => {
    const path = route.path

    if (path === DASHBOARD_PATH || path === '') {
      return [{ label: 'Dashboard', to: DASHBOARD_PATH }]
    }

    let best: { groupLabel: string; childLabel: string; childTo: string } | null = null

    for (const group of navigationGroups) {
      for (const child of group.children) {
        const childTo = child.to
        if (!childTo) continue

        const isMatch = path === childTo || path.startsWith(`${childTo}/`)
        if (!isMatch) continue

        if (!best || childTo.length > best.childTo.length) {
          best = {
            groupLabel: group.label,
            childLabel: child.label,
            childTo,
          }
        }
      }
    }

    if (best) {
      return [{ label: best.groupLabel }, { label: best.childLabel, to: best.childTo }]
    }

    return [{ label: 'Dashboard', to: DASHBOARD_PATH }]
  })

  return { breadcrumb }
}
