import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { navigationGroups } from '@/app/navigation/navigation.registry'

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
 * - `/` (or empty) → single item `Dashboard`.
 * - A child whose `to` is an exact match or a path-prefix of the current route
 *   (covers sub-routes like `/:id`, `/nueva`, `/crear/:type`). When several
 *   children match, the most specific (longest `to`) wins, so e.g.
 *   `/admin/colaboradores/documentos-vencer` resolves to `RR.HH. / Vencimientos`
 *   and not to the shorter `RR.HH. / Colaboradores`.
 * - No match → fallback to `Dashboard`.
 */
export const useBreadcrumb = () => {
  const route = useRoute()

  const breadcrumb = computed<BreadcrumbItem[]>(() => {
    const path = route.path

    if (path === '/' || path === '') {
      return [{ label: 'Dashboard', to: '/' }]
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
      return [
        { label: best.groupLabel },
        { label: best.childLabel, to: best.childTo },
      ]
    }

    return [{ label: 'Dashboard', to: '/' }]
  })

  return { breadcrumb }
}
