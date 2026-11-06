<script setup lang="ts">
/**
 * ZoneValidationsView — «Validaciones de zona» (ODD shipping-settings T2, S2):
 * the chatbot's pending delivery-zone validations, earliest deadline first,
 * with a live countdown. The open validation lives in `?validation=<id>`;
 * `?zipCode=NNNNN` finds the pending validation of a postal code (L5/L7).
 */
import { computed, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { useNow } from '@vueuse/core'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { zoneValidationsApi } from '../api/deliveryZones.api'
import { zoneValidationKeys } from '../constants/queryKeys'
import { useZoneValidationsQueue } from '../composables/useZoneValidations'
import type { ZoneValidation } from '../interfaces/delivery-zone.types'
import ZoneValidationDrawer from '../components/ZoneValidationDrawer.vue'
import ZoneValidationList from '../components/ZoneValidationList.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const tenantId = useSafeTenantId()
const queryClient = useQueryClient()
const canResolve = computed(() => auth.userCan('validate', 'DeliveryZone'))

// The countdowns tick on the client; the queue itself refetches every minute.
const clock = useNow({ interval: 15_000 })
const now = computed(() => clock.value.getTime())

const { pagination, validations, totalCount, pageCount, isLoading, isFetching, error, refetch } = useZoneValidationsQueue()
const notice = shallowRef('')

const openId = computed(() => (typeof route.query.validation === 'string' && route.query.validation ? route.query.validation : null))

function setQuery(query: Record<string, string>) {
  return router.replace({ query })
}
function openValidation(validation: Pick<ZoneValidation, 'id'>) {
  notice.value = ''
  void setQuery({ validation: validation.id })
}
function closeValidation() {
  void setQuery({})
}
function onGone(message: string) {
  notice.value = message
  closeValidation()
  void refetch()
}

async function findByZipCode(zipCode: string) {
  if (!/^\d{5}$/.test(zipCode)) {
    notice.value = 'El código postal debe tener 5 dígitos.'
    return setQuery({})
  }
  const params = { page: 1, limit: 1, zipCode }
  try {
    const page = await queryClient.fetchQuery({
      queryKey: zoneValidationKeys.list(tenantId.value, params),
      queryFn: ({ signal }) => zoneValidationsApi.list(params, signal),
      staleTime: 0,
    })
    const match = page.data[0]
    if (match) return setQuery({ validation: match.id })
    notice.value = `No hay una validación pendiente para el código postal ${zipCode}.`
  } catch {
    notice.value = `No se pudo buscar la validación del código postal ${zipCode}.`
  }
  return setQuery({})
}

watch(
  () => route.query.zipCode,
  (zipCode) => {
    if (typeof zipCode === 'string' && canResolve.value && tenantId.value) void findByZipCode(zipCode.trim())
  },
  { immediate: true },
)
</script>

<template>
  <div class="hf-theme hf-ui zone-validations flex w-full min-w-0 flex-col gap-6 md:px-6 lg:px-10">
    <header class="hf-page-header">
      <h1 class="hf-page-title">Validaciones de zona</h1>
      <p class="hf-page-subtitle">Códigos postales que el chatbot pidió confirmar.</p>
    </header>

    <p v-if="notice" role="status" class="zone-validations-notice">{{ notice }}</p>

    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hf-table-surface w-full min-w-0 max-w-full overflow-hidden shadow-sm" aria-label="Validaciones pendientes">
      <div class="hf-table-content w-full min-w-0 px-3 py-3 sm:px-4 sm:py-4">
        <ZoneValidationList
          v-model:pagination="pagination"
          :validations="validations"
          :now="now"
          :loading="isLoading"
          :fetching="isFetching"
          :error="!!error"
          :total-count="totalCount"
          :page-count="pageCount"
          @open="openValidation"
          @refresh="refetch()"
        />
      </div>
    </UCard>

    <ZoneValidationDrawer
      :validation-id="openId"
      :now="now"
      :can-resolve="canResolve"
      @close="closeValidation"
      @gone="onGone"
    />
  </div>
</template>

<style scoped>
.zone-validations { color: var(--hf-ink); }
.zone-validations-notice { border-radius: 6px; background: var(--hf-active-soft); color: var(--hf-ink); padding: 12px 16px; }
</style>
