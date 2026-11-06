<script setup lang="ts">
/**
 * ShippingSettingsView — «Envíos» (ODD shipping-settings S2): tabs Zonas /
 * Cajas / Origen / Horario, the active one in `?tab=`. Zonas needs
 * read:DeliveryZone; edits in Cajas, Origen and Horario need
 * update:ShippingSettings. Leaving a tab with unsaved changes asks first.
 */
import { computed, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { confirmLeave, useLeaveGuard } from '@/core/shared/composables/useLeaveGuard'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import DeliveryZonesPanel from '@/features/shipping/delivery-zones/components/DeliveryZonesPanel.vue'
import OpeningHoursPanel from '../components/OpeningHoursPanel.vue'
import ShippingBoxesPanel from '../components/ShippingBoxesPanel.vue'
import ShippingOriginPanel from '../components/ShippingOriginPanel.vue'
import { resolveShippingTab, visibleShippingTabs, type ShippingTabKey } from '../utils/shippingTabs'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const tenantId = useSafeTenantId()

const canUpdate = computed(() => auth.userCan('update', 'ShippingSettings'))
const tabs = computed(() => visibleShippingTabs({ canReadZones: auth.userCan('read', 'DeliveryZone') }))
const activeTab = computed(() => resolveShippingTab(route.query.tab, tabs.value))
const activeTabLabel = computed(() => tabs.value.find((tab) => tab.key === activeTab.value)?.label ?? '')

// The active panel reports unsaved edits; a tab switch is not a route leave.
const dirty = shallowRef(false)
useLeaveGuard(dirty)

async function setTab(key: ShippingTabKey) {
  if (key === activeTab.value) return
  if (dirty.value && !(await confirmLeave())) return
  dirty.value = false
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
        v-for="tab in tabs"
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
      <DeliveryZonesPanel v-if="activeTab === 'zonas'" />
      <ShippingBoxesPanel v-else-if="activeTab === 'cajas'" :tenant-id="tenantId" :can-update="canUpdate" @dirty="dirty = $event" />
      <ShippingOriginPanel v-else-if="activeTab === 'origen'" :tenant-id="tenantId" :can-update="canUpdate" @dirty="dirty = $event" />
      <OpeningHoursPanel v-else :tenant-id="tenantId" :can-update="canUpdate" @dirty="dirty = $event" />
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
