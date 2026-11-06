<script setup lang="ts">
/**
 * ShippingSettingsView — «Envíos» (ODD shipping-settings T1, S2): tabs Zonas /
 * Cajas / Origen / Horario, the active one in `?tab=`. Placeholder panels until
 * T2 (Zonas, guarded by read:DeliveryZone) and T3 (Cajas, Origen, Horario).
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import { SHIPPING_TABS, resolveShippingTab, type ShippingTabKey } from '../utils/shippingTabs'

const route = useRoute()
const router = useRouter()

const activeTab = computed(() => resolveShippingTab(route.query.tab))
const activeTabLabel = computed(
  () => SHIPPING_TABS.find((tab) => tab.key === activeTab.value)!.label,
)

function setTab(key: ShippingTabKey) {
  if (key === activeTab.value) return
  void router.replace({ query: { ...route.query, tab: key } })
}
</script>

<template>
  <div class="hf-theme hf-ui flex w-full min-w-0 flex-col gap-6 md:px-6 lg:px-10">
    <header class="hf-page-header">
      <h1 class="hf-page-title">Envíos</h1>
      <p class="hf-page-subtitle">Zonas de entrega, cajas, origen y horario de la sucursal.</p>
    </header>

    <div class="shipping-tabs" role="tablist" aria-label="Secciones de envíos">
      <button
        v-for="tab in SHIPPING_TABS"
        :key="tab.key"
        type="button"
        role="tab"
        class="shipping-tab"
        :data-testid="`shipping-tab-${tab.key}`"
        :aria-selected="activeTab === tab.key"
        @click="setTab(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="min-w-0" role="tabpanel" :aria-label="activeTabLabel">
      <EmptyState :title="`${activeTabLabel}: todavía no disponible`" />
    </div>
  </div>
</template>

<style scoped>
.shipping-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  border-bottom: 1px solid var(--hf-border);
  scrollbar-width: none;
}

.shipping-tab {
  min-height: 44px;
  margin-bottom: -1px;
  border-bottom: 2px solid transparent;
  padding: 0 12px;
  color: var(--hf-muted);
  font-size: 14px;
  white-space: nowrap;
}

.shipping-tab:hover {
  color: var(--hf-ink);
}

.shipping-tab[aria-selected='true'] {
  border-bottom-color: var(--hf-ink);
  color: var(--hf-ink);
  font-weight: 500;
}

.shipping-tab:focus-visible {
  outline: 2px solid var(--hf-focus);
  outline-offset: 2px;
}
</style>
