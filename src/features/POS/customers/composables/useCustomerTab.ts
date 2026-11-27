/**
 * The open tab of the customer page, kept in `?tab=` (customers-module T4; `cobros` from T5). `resumen` is the
 * default and is left out of the URL; a tab the person cannot see, or an unknown one, falls back to
 * it. Changing tab replaces the history entry (tabs are not navigation steps) and keeps the rest of
 * the query.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export const CUSTOMER_TABS = ['resumen', 'ventas', 'cobros', 'mascotas', 'cotizaciones', 'datos'] as const
export type CustomerTab = (typeof CUSTOMER_TABS)[number]
export const DEFAULT_CUSTOMER_TAB: CustomerTab = 'resumen'

export function useCustomerTab(available: MaybeRefOrGetter<readonly CustomerTab[]>) {
  const route = useRoute()
  const router = useRouter()

  const activeTab = computed<CustomerTab>(() => {
    const raw = route.query.tab
    const requested = Array.isArray(raw) ? raw[0] : raw
    const allowed = toValue(available)
    return allowed.includes(requested as CustomerTab) ? (requested as CustomerTab) : DEFAULT_CUSTOMER_TAB
  })

  function setTab(tab: CustomerTab) {
    if (tab === activeTab.value) return
    const query = { ...route.query }
    if (tab === DEFAULT_CUSTOMER_TAB) delete query.tab
    else query.tab = tab
    void router.replace({ query })
  }

  return { activeTab, setTab }
}
