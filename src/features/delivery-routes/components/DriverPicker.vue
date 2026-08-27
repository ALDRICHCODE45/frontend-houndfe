<script setup lang="ts">
/**
 * DriverPicker — Single-select driver picker for delivery-route create/edit.
 *
 * Contract (sdd delivery-routes, design.md §4.1, §13.1):
 *   - Single-select over `usersApi.listAssignableDrivers()` (returns AssignableUser[]).
 *   - Renders {id, name} verbatim from the API response — NO client-side filter
 *     (courier-scoping is server-side per the §13.1 gate).
 *   - v-model:driverUserId with a `string | null` value.
 *   - Empty state: "No hay repartidores disponibles".
 *   - Loading + error states are surfaced via dedicated elements
 *     (`[data-testid="driver-picker-loading"]` / `driver-picker-error`).
 *   - API URL pin: spec asserts `GET /users/assignable-drivers` is the only fetch
 *     (so a future scoped endpoint is a visible contract change).
 *
 * The picker consumes the DEDICATED `usersApi.listAssignableDrivers()` source —
 * pure drivers only (active users whose tenant role has read+update on
 * DeliveryRoute, without create/delete), served by the dedicated
 * `GET /users/assignable-drivers` endpoint. It has its OWN TanStack cache slot
 * (`usersQueryKeys.assignableDrivers()` → ['users', 'assignable-drivers']), NO
 * longer shared with the notification recipients picker (which stays on the
 * broader ['users', 'assignable'] slot via `usersApi.listAssignable()` — that
 * slot carries managers and must never leak into the driver dropdown).
 *
 * Selected driver is also surfaced as an explicit chip below the trigger
 * (with a clear button) so the slideover's create/edit mode can render a
 * stable "Driver: X" summary without depending on the dropdown's internal
 * display value, AND so tests can assert the selected label without
 * navigating USelectMenu internals.
 */
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { usersApi } from '@/features/POS/users/api/user.api'
import { usersQueryKeys } from '@/core/shared/constants/query-keys'
import type { AssignableUser } from '@/features/POS/users/interfaces/user.types'

const props = withDefaults(
  defineProps<{
    /** Selected driver user id, or `null` when no driver is selected. */
    modelValue: string | null
    /** Visual required marker — does not gate validation (slideover owns zod). */
    required?: boolean
    /** Whether the picker is disabled. */
    disabled?: boolean
    /** Optional placeholder text. */
    placeholder?: string
    /** Optional inline field error. */
    error?: string
  }>(),
  {
    required: false,
    disabled: false,
    placeholder: 'Selecciona un repartidor',
    error: '',
  },
)

const emit = defineEmits<{
  'update:driverUserId': [value: string | null]
}>()

/**
 * Single source of truth: GET /users/assignable-drivers — the spec pins this
 * URL. Uses its OWN dedicated cache slot (`usersQueryKeys.assignableDrivers()`
 * → ['users', 'assignable-drivers']), isolated from the notification recipients
 * picker's broader ['users', 'assignable'] slot (that slot carries managers
 * and would leak them into the driver dropdown). `staleTime` matches the
 * recipient picker cache (60s) so repeated opens within a slideover session
 * don't re-fetch.
 */
const assignableQuery = useQuery<AssignableUser[]>({
  queryKey: usersQueryKeys.assignableDrivers(),
  queryFn: () => usersApi.listAssignableDrivers(),
  staleTime: 60_000,
})

const assignable = computed<AssignableUser[]>(() => assignableQuery.data.value ?? [])
const isLoading = computed(() => assignableQuery.isLoading.value)
const isError = computed(() => assignableQuery.isError.value)
const errorMessage = computed(() => {
  const err = assignableQuery.error.value
  if (!err) return ''
  return err instanceof Error ? err.message : String(err)
})

/**
 * Resolve the selected option by id against the latest assignable list. Emit
 * only the id on update so the parent owns the v-model.
 */
const selectedOption = computed<AssignableUser | null>(() => {
  if (!props.modelValue) return null
  return assignable.value.find((u) => u.id === props.modelValue) ?? null
})

function onUpdate(next: AssignableUser | null) {
  emit('update:driverUserId', next?.id ?? null)
}

function clearSelection() {
  emit('update:driverUserId', null)
}
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="driver-picker">
    <USelectMenu
      :model-value="selectedOption"
      :items="assignable"
      value-key="id"
      label-key="name"
      :loading="isLoading"
      :disabled="disabled"
      :placeholder="placeholder"
      class="w-full"
      data-testid="driver-picker-trigger"
      @update:model-value="onUpdate"
    >
      <template #empty>
        <p
          class="p-2 text-center text-sm text-muted"
          data-testid="driver-picker-empty"
        >
          No hay repartidores disponibles
        </p>
      </template>
    </USelectMenu>

    <!-- Inline empty-state copy so the empty message is reachable without
         opening the dropdown (matches the contract: the empty copy is a
         visible page-level affordance, not a dropdown-only label). -->
    <p
      v-if="!isLoading && !isError && assignable.length === 0"
      class="text-sm text-muted"
      data-testid="driver-picker-empty-inline"
    >
      No hay repartidores disponibles
    </p>

    <!-- Selected driver chip with explicit clear affordance — keeps the
         selection state visible below the trigger so the slideover can
         render "Driver: X" without depending on USelectMenu internals. -->
    <div
      v-if="selectedOption"
      class="inline-flex items-center gap-2 self-start rounded-full border border-default bg-elevated/50 px-3 py-1 text-sm"
      :data-testid="`driver-picker-chip-${selectedOption.id}`"
    >
      <span data-testid="driver-picker-chip-label">{{ selectedOption.name }}</span>
      <button
        type="button"
        :aria-label="`Quitar ${selectedOption.name}`"
        class="inline-flex size-4 items-center justify-center rounded-full hover:bg-elevated"
        data-testid="driver-picker-chip-clear"
        @click="clearSelection"
      >
        <UIcon name="i-lucide-x" class="size-3" />
      </button>
    </div>

    <div
      v-if="isLoading"
      class="text-xs text-muted"
      data-testid="driver-picker-loading"
      aria-busy="true"
    >
      Cargando repartidores…
    </div>

    <div
      v-if="isError"
      class="text-xs text-error"
      data-testid="driver-picker-error"
    >
      {{ errorMessage }}
    </div>

    <p
      v-if="required"
      class="text-xs text-muted"
      data-testid="driver-picker-required"
    >
      Requerido
    </p>

    <p
      v-if="error"
      class="text-xs text-error"
      data-testid="driver-picker-error-inline"
    >
      {{ error }}
    </p>
  </div>
</template>
