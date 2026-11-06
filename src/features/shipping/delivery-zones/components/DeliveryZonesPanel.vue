<script setup lang="ts">
/**
 * DeliveryZonesPanel — the «Zonas» tab of Envíos (ODD shipping-settings T2,
 * S1/S7): zones list with search, type and active filters; create, edit,
 * reactivate and deactivate with manage:DeliveryZone (read-only otherwise).
 * A save that hits a pending validation opens that validation (L7).
 */
import { computed, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import ToolbarSelectFilter from '@/core/shared/components/DataTable/ToolbarSelectFilter.vue'
import { ZONE_VALIDATIONS_PATH } from '@/app/navigation/navigation.registry'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { DEFAULT_ZONE_ACTIVE, useDeliveryZones, type ZoneActiveFilter } from '../composables/useDeliveryZones'
import { useSessionLogout } from '../composables/useSessionLogout'
import { useZoneCommands } from '../composables/useZoneCommands'
import type { DeliveryZone, DeliveryZoneType } from '../interfaces/delivery-zone.types'
import { mapZoneWriteError } from '../utils/zoneErrors'
import { buildZoneUpsertBody, draftFromZone, emptyZoneDraft, ZONE_TYPE_LABELS, type ZoneDraft, type ZoneFieldErrors } from '../utils/zoneForm'
import DeliveryZoneForm from './DeliveryZoneForm.vue'
import DeliveryZoneList from './DeliveryZoneList.vue'

const auth = useAuthStore()
const router = useRouter()
const logout = useSessionLogout()
const canManage = computed(() => auth.userCan('manage', 'DeliveryZone'))

const list = useDeliveryZones()
const { search, type, active, pagination, filtered, zones, totalCount, pageCount, isLoading, isFetching, error } = list
const { upsert, deactivate } = useZoneCommands()

const typeItems = [
  { label: 'Todos', value: 'ALL' },
  ...(Object.keys(ZONE_TYPE_LABELS) as DeliveryZoneType[]).map((value) => ({ label: ZONE_TYPE_LABELS[value], value })),
]
const activeItems = [
  { label: 'Activas', value: 'ACTIVE' },
  { label: 'Inactivas', value: 'INACTIVE' },
  { label: 'Todas', value: 'ALL' },
]
const typeFilter = computed({
  get: () => type.value ?? 'ALL',
  set: (value: string) => { type.value = value === 'ALL' ? undefined : (value as DeliveryZoneType) },
})
const activeFilter = computed({
  get: () => active.value,
  set: (value: string) => { active.value = value as ZoneActiveFilter },
})
const activeFilterCount = computed(() => (type.value ? 1 : 0) + (active.value !== DEFAULT_ZONE_ACTIVE ? 1 : 0))

const notice = shallowRef('')

// ── Form ────────────────────────────────────────────────────────────────────
const formOpen = shallowRef(false)
const formKey = shallowRef(0)
const editing = shallowRef<DeliveryZone | null>(null)
const formInitial = shallowRef<ZoneDraft>(emptyZoneDraft())
const serverErrors = shallowRef<ZoneFieldErrors>({})
const serverMessage = shallowRef('')

const formTitle = computed(() => {
  if (!editing.value) return 'Nueva zona'
  return editing.value.isActive ? `Zona ${editing.value.zipCode}` : `Reactivar zona ${editing.value.zipCode}`
})
const submitLabel = computed(() => {
  if (!editing.value) return 'Crear zona'
  return editing.value.isActive ? 'Guardar cambios' : 'Reactivar zona'
})

function openForm(zone: DeliveryZone | null) {
  if (!canManage.value) return
  editing.value = zone
  formInitial.value = zone ? draftFromZone(zone) : emptyZoneDraft()
  serverErrors.value = {}
  serverMessage.value = ''
  notice.value = ''
  formKey.value++
  formOpen.value = true
}

async function save(draft: ZoneDraft) {
  serverErrors.value = {}
  serverMessage.value = ''
  const zipCode = draft.zipCode.trim()
  try {
    await upsert.mutateAsync({ zipCode, body: buildZoneUpsertBody(draft) })
    formOpen.value = false
    notice.value = editing.value?.isActive ? `Zona ${zipCode} guardada.` : editing.value ? `Zona ${zipCode} reactivada.` : `Zona ${zipCode} creada.`
  } catch (err) {
    const mapped = mapZoneWriteError(err)
    if (mapped.kind === 'validation-pending') {
      formOpen.value = false
      void router.push({ path: ZONE_VALIDATIONS_PATH, query: { validation: mapped.validationId } })
      return
    }
    if (mapped.kind === 'logout') return logout()
    serverErrors.value = mapped.fieldErrors
    serverMessage.value = mapped.message
  }
}

// ── Deactivate ──────────────────────────────────────────────────────────────
const deactivateTarget = shallowRef<DeliveryZone | null>(null)
const deactivateMessage = shallowRef('')
const deactivateOpen = computed({
  get: () => deactivateTarget.value !== null,
  set: (open: boolean) => { if (!open && !deactivate.isPending.value) deactivateTarget.value = null },
})
function askDeactivate(zone: DeliveryZone) {
  if (!canManage.value) return
  notice.value = ''
  deactivateMessage.value = ''
  deactivateTarget.value = zone
}
async function confirmDeactivate() {
  const target = deactivateTarget.value
  if (!target) return
  try {
    await deactivate.mutateAsync(target.zipCode)
    deactivateTarget.value = null
    notice.value = `Zona ${target.zipCode} desactivada.`
  } catch (err) {
    const mapped = mapZoneWriteError(err)
    if (mapped.kind === 'logout') return logout()
    if (mapped.kind === 'reload') {
      deactivateTarget.value = null
      notice.value = mapped.message
      void list.refetch()
      return
    }
    deactivateMessage.value = mapped.message
  }
}
</script>

<template>
  <section class="delivery-zones" aria-label="Zonas de entrega">
    <p v-if="notice" role="status" class="zone-notice">{{ notice }}</p>
    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hf-table-surface w-full min-w-0 max-w-full overflow-hidden shadow-sm">
      <div class="hf-table-content w-full min-w-0 px-3 py-3 sm:px-4 sm:py-4">
        <DeliveryZoneList
          v-model:search="search"
          v-model:pagination="pagination"
          :zones="zones"
          :can-manage="canManage"
          :loading="isLoading"
          :fetching="isFetching"
          :error="!!error"
          :filtered="filtered"
          :total-count="totalCount"
          :page-count="pageCount"
          :active-filter-count="activeFilterCount"
          @edit="openForm"
          @deactivate="askDeactivate"
          @create="openForm(null)"
          @refresh="list.refetch()"
          @clear-filters="list.clearFilters()"
        >
          <template #filters>
            <ToolbarSelectFilter v-model="typeFilter" :items="typeItems" label="Tipo" portal-class="hf-theme hf-ui delivery-zones-portal" test-id="zone-type-filter" />
            <ToolbarSelectFilter v-model="activeFilter" :items="activeItems" label="Estado" portal-class="hf-theme hf-ui delivery-zones-portal" test-id="zone-active-filter" />
          </template>
          <template v-if="canManage" #actions>
            <UButton data-testid="zone-create" class="hf-primary-control" icon="i-lucide-plus" @click="openForm(null)">Nueva zona</UButton>
          </template>
        </DeliveryZoneList>
      </div>
    </UCard>

    <USlideover
      v-model:open="formOpen"
      :title="formTitle"
      :dismissible="!upsert.isPending.value"
      :ui="{ content: 'hf-theme hf-ui hf-form-overlay delivery-zones-portal' }"
    >
      <template #body>
        <DeliveryZoneForm
          v-if="formOpen"
          :key="formKey"
          :initial="formInitial"
          :editing="editing !== null"
          :submit-label="submitLabel"
          :saving="upsert.isPending.value"
          :server-errors="serverErrors"
          :server-message="serverMessage"
          @submit="save"
        />
      </template>
    </USlideover>

    <UModal
      v-model:open="deactivateOpen"
      :title="deactivateTarget ? `¿Desactivar la zona ${deactivateTarget.zipCode}?` : ''"
      :dismissible="!deactivate.isPending.value"
      :ui="{ content: 'hf-theme hf-ui delivery-zones-portal' }"
    >
      <template #body>
        <p class="zone-confirm-text">
          La zona {{ deactivateTarget?.zipCode }} deja de usarse: el próximo cliente de este código postal abrirá una validación nueva. Puedes reactivarla después.
        </p>
        <p v-if="deactivateMessage" role="alert" class="zone-confirm-alert">{{ deactivateMessage }}</p>
      </template>
      <template #footer>
        <div class="zone-confirm-actions">
          <UButton variant="outline" color="neutral" :disabled="deactivate.isPending.value" @click="deactivateTarget = null">Cancelar</UButton>
          <UButton color="error" icon="i-lucide-power-off" data-testid="zone-deactivate-confirm" :loading="deactivate.isPending.value" @click="confirmDeactivate">Desactivar</UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>

<style scoped>
.delivery-zones { display: grid; gap: 16px; min-width: 0; color: var(--hf-ink); }
.zone-notice { border-radius: 6px; background: var(--hf-active-soft); color: var(--hf-ink); padding: 12px 16px; }
.zone-confirm-text { color: var(--hf-ink); font-size: 14px; }
.zone-confirm-alert { margin-top: 12px; border: 1px solid var(--hf-danger-border); border-radius: 6px; background: var(--hf-danger-soft); color: var(--hf-danger); padding: 12px; font-size: 14px; }
.zone-confirm-actions { display: flex; width: 100%; justify-content: flex-end; gap: 8px; }
</style>
