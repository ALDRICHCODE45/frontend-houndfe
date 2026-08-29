<script setup lang="ts">
/**
 * DeliveryRouteUpsertSlideover — S4c (sdd delivery-routes, design.md §4.1, §11).
 *
 * Create/edit form for delivery routes. One form owns both modes; the parent
 * owns the mutation (payment-details convention) and consumes the emitted
 * `create` / `edit` payload.
 *
 *   - mode="create": EligibleSalesPicker (multi-select) + DriverPicker + notes (≤280).
 *   - mode="edit":   DriverPicker + notes only. Sales picker is HIDDEN.
 *
 * Field-level zod validation lives on the submit path (inline errors, slideover
 * stays open on invalid). Errors are surfaced via:
 *   - the picker's `error` prop (sales picker / driver picker), AND
 *   - a UFormField `error` slot on the wrapper UFormField below each control.
 *
 * The backend re-validates (DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE → 422). The
 * caller is responsible for routing that through the inline picker error per
 * design §7.2; S4c's slice keeps the slideover self-contained.
 *
 * Edit payload:
 *   - When `notes` is non-empty after trim → emit `notes: <trimmed string>`.
 *   - When `notes` is empty after trim → emit `notes: null` (PATCH semantics,
 *     clears the backend value).
 *
 * Create payload:
 *   - `saleIds` array (≥1, UUID). When the user submits with an empty array,
 *     the form shows the canonical "Selecciona al menos una venta" copy and
 *     blocks the request.
 *   - `driverUserId` (UUID). When empty, the form blocks.
 *   - `notes` (≤280 chars after trim). When empty, omitted from the payload
 *     (whitelist — never send an empty string).
 */
import { computed, reactive, ref, watch } from 'vue'
import type { FormSubmitEvent } from '@nuxt/ui'
import { z } from 'zod'
import EligibleSalesPicker from './EligibleSalesPicker.vue'
import DriverPicker from './DriverPicker.vue'
import { DELIVERY_ROUTE_COPY } from '../copy'
import { CreateDeliveryRouteSchema, UpdateDeliveryRouteSchema } from '../interfaces/delivery-route.types'
import type { CreateDeliveryRouteRequest, UpdateDeliveryRouteRequest } from '../interfaces/delivery-route.types'

const props = withDefaults(
  defineProps<{
    /** Slideover open state — two-way bound via v-model:open. */
    open: boolean
    /** Create vs edit mode. */
    mode: 'create' | 'edit'
    /** Required for edit mode — the route id (used for form identity / future deep-link). */
    routeId?: string
    /** Initial notes (edit mode prefill). */
    initialNotes?: string | null
    /** Initial driver (edit mode prefill). */
    initialDriverUserId?: string | null
    /** Submit in-flight state — disables the submit button. */
    loading?: boolean
  }>(),
  {
    routeId: '',
    initialNotes: '',
    initialDriverUserId: null,
    loading: false,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  create: [payload: CreateDeliveryRouteRequest]
  edit: [payload: UpdateDeliveryRouteRequest]
}>()

const formId = computed(() =>
  props.mode === 'create' ? 'create-delivery-route-form' : 'edit-delivery-route-form',
)

// ─── Local reactive form state ───────────────────────────────────────────────
// Single reactive object drives BOTH the UForm :state (so Nuxt UI does NOT
// mark the UFormField controls as invalid / red border just because the key
// is missing from an empty state object) AND the picker/textarea `v-model`s.
// This mirrors the project-wide pattern (e.g. useRoleForm's `reactive` state +
// `v-model="state.x"`), which is what keeps Nuxt UI from flagging the fields.
const formState = reactive({
  saleIds: [] as string[],
  driverUserId: (props.initialDriverUserId ?? null) as string | null,
  notes: (props.initialNotes ?? '') as string,
})

// Field-level error messages (inline). Clean state is `undefined` — NOT
// `''` — so Nuxt UI's UFormField treats the field as error-free (an empty
// string is still truthy for the `error` prop and paints an invalid ring on
// a clean field). Real error strings are preserved unchanged.
const salesError = ref<string | undefined>(undefined)
const driverError = ref<string | undefined>(undefined)
const notesError = ref<string | undefined>(undefined)

// ─── Edit-mode prefill watcher ───────────────────────────────────────────────
watch(
  () => [props.mode, props.routeId, props.open] as const,
  ([mode, _routeId, isOpen]) => {
    if (mode !== 'edit') return
    if (!isOpen) return
    formState.driverUserId = props.initialDriverUserId ?? null
    formState.notes = props.initialNotes ?? ''
  },
  { immediate: true },
)

// ─── Create-mode reset on open ───────────────────────────────────────────────
watch(
  () => [props.mode, props.open] as const,
  ([mode, isOpen]) => {
    if (!isOpen) return
    if (mode === 'create') {
      formState.saleIds = []
      formState.driverUserId = null
      formState.notes = ''
    }
    salesError.value = undefined
    driverError.value = undefined
    notesError.value = undefined
  },
  { immediate: true },
)

const isCreate = computed(() => props.mode === 'create')
const isEdit = computed(() => props.mode === 'edit')

const title = computed(() =>
  props.mode === 'create' ? 'Crear ruta de entrega' : 'Editar ruta de entrega',
)
const description = computed(() =>
  props.mode === 'create'
    ? 'Selecciona las ventas, asigna un repartidor y agrega notas opcionales.'
    : 'Actualiza el repartidor o las notas de la ruta.',
)

// ─── Submit path — zod-inline validation, then emit ──────────────────────────
//
// Build the candidate payload, run the canonical zod schema (whitelist + size
// + type checks), and route the first failure to the matching inline error.
// The schemas live in `interfaces/delivery-route.types.ts` and are the single
// source for "what crosses the wire" — the slideover never forges the wire
// shape itself.

function clearErrors() {
  salesError.value = undefined
  driverError.value = undefined
  notesError.value = undefined
}

function tryEmitCreate(payload: CreateDeliveryRouteRequest): boolean {
  const result = CreateDeliveryRouteSchema.safeParse(payload)
  if (!result.success) {
    applyZodErrors(result.error)
    return false
  }
  clearErrors()
  // Re-emit ONLY the whitelisted keys (zod already stripped unknowns via .strict()).
  const safe: CreateDeliveryRouteRequest = {
    saleIds: result.data.saleIds,
    driverUserId: result.data.driverUserId,
  }
  if (result.data.notes !== undefined) safe.notes = result.data.notes
  emit('create', safe)
  return true
}

function tryEmitEdit(payload: UpdateDeliveryRouteRequest): boolean {
  // Edit always carries the current driver — an empty driver blocks submission
  // (co-located spec: driver is required in the edit form, REQ-DRM-007).
  if (!payload.driverUserId) {
    driverError.value = DELIVERY_ROUTE_COPY.validation.selectDriver
    return false
  }
  const result = UpdateDeliveryRouteSchema.safeParse(payload)
  if (!result.success) {
    applyZodErrors(result.error)
    return false
  }
  clearErrors()
  // Re-emit ONLY the whitelisted keys.
  const safe: UpdateDeliveryRouteRequest = {}
  if (result.data.driverUserId !== undefined) safe.driverUserId = result.data.driverUserId
  if (result.data.notes !== undefined) safe.notes = result.data.notes
  emit('edit', safe)
  return true
}

function applyZodErrors(err: z.ZodError): void {
  // The canonical Spanish copy is carried by the schema (`min(1, '…')`,
  // `max(280, '…')`); we surface the FIRST issue per field.
  const seen = { saleIds: false, driverUserId: false, notes: false }
  for (const issue of err.issues) {
    const path = issue.path[0]
    if (path === 'saleIds' && !seen.saleIds) {
      salesError.value = issue.message
      seen.saleIds = true
    } else if (path === 'driverUserId' && !seen.driverUserId) {
      driverError.value = issue.message
      seen.driverUserId = true
    } else if (path === 'notes' && !seen.notes) {
      notesError.value = issue.message
      seen.notes = true
    }
  }
}

function onSubmit(_event: FormSubmitEvent<unknown>): void {
  // Normalize notes (trim) before validation; preserve the user's typed value
  // for edit-mode null-on-clear semantics.
  const trimmedNotes = formState.notes.trim()

  if (props.mode === 'create') {
    const payload: CreateDeliveryRouteRequest = {
      saleIds: formState.saleIds,
      driverUserId: formState.driverUserId ?? '',
    }
    if (trimmedNotes.length > 0) {
      payload.notes = trimmedNotes
    }
    tryEmitCreate(payload)
    return
  }

  // Edit: emit driver + notes only. For "notes cleared" → null (REQ-DRM-005).
  const payload: UpdateDeliveryRouteRequest = {
    driverUserId: formState.driverUserId ?? undefined,
    notes: trimmedNotes.length > 0 ? trimmedNotes : null,
  }
  tryEmitEdit(payload)
}

function handleClose() {
  clearErrors()
  emit('update:open', false)
}

function onSalesChange(next: string[]) {
  formState.saleIds = Array.isArray(next) ? [...next] : []
  if (formState.saleIds.length > 0 && salesError.value) {
    salesError.value = undefined
  }
}

function onDriverChange(next: string | null) {
  formState.driverUserId = next
  if (next && driverError.value) {
    driverError.value = undefined
  }
}

function onNotesChange(next: string | string[]) {
  formState.notes = typeof next === 'string' ? next : next.join('')
  if (notesError.value && formState.notes.trim().length <= 280) {
    notesError.value = undefined
  }
}

// Mirror the validation copy from copy.ts so the slideover renders the same
// Spanish text the rest of the module uses.
const validation = DELIVERY_ROUTE_COPY.validation
void validation // used implicitly via the zod schema messages below.

// ─── Test-only handles (used by co-located strict-TDD specs) ─────────────────
//
// Exposing setter/getter objects lets the spec drive v-model mutations without
// reaching into the picker DOM (the pickers themselves have their own specs).
// We expose getters/setters (instead of the raw refs) because `defineExpose`
// unwraps top-level refs on the public instance, which would lose mutability.
//
// Production code MUST NOT use these handles — they live behind a `__test` prefix
// to make accidental consumption visible in code review.
defineExpose({
  __testSelectedSaleIds: {
    get value() {
      return formState.saleIds
    },
    set value(v: string[]) {
      formState.saleIds = v
    },
  },
  __testSelectedDriverUserId: {
    get value() {
      return formState.driverUserId
    },
    set value(v: string | null) {
      formState.driverUserId = v
    },
  },
  __testNotes: {
    get value() {
      return formState.notes
    },
    set value(v: string) {
      formState.notes = v
    },
  },
})
</script>

<template>
  <USlideover
    :open="open"
    :title="title"
    :description="description"
    side="right"
    inset
    @update:open="handleClose"
  >
    <template #body>
      <UForm
        :id="formId"
        :state="formState"
        class="flex flex-col gap-4"
        @submit="onSubmit"
      >
        <UFormField
          v-if="isCreate"
          label="Ventas"
          name="saleIds"
                :error="salesError"
          help="Selecciona una o más ventas pendientes o enviadas."
          required
        >
          <EligibleSalesPicker
                :model-value="formState.saleIds"
                :error="salesError"
                :highlight="false"
                @update:selected="onSalesChange"
                @update:model-value="onSalesChange"
          />
        </UFormField>

        <UFormField
          label="Repartidor"
          name="driverUserId"
                :error="driverError"
          required
        >
          <DriverPicker
                :model-value="formState.driverUserId"
                :error="driverError"
                :highlight="false"
                @update:driver-user-id="onDriverChange"
                @update:model-value="onDriverChange"
          />
        </UFormField>

        <UFormField
          label="Notas"
          name="notes"
          :error="notesError"
          help="Opcional. Máximo 280 caracteres."
        >
          <UTextarea
            :model-value="formState.notes"
            :highlight="false"
            :rows="3"
            placeholder="Ej: Llevar cambio"
            @update:model-value="onNotesChange"
          />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton label="Cancelar" color="neutral" variant="outline" @click="handleClose" />
        <UButton
          :label="isCreate ? 'Crear ruta' : 'Guardar cambios'"
          :loading="loading"
          type="submit"
          :form="formId"
        />
      </div>
    </template>
  </USlideover>
</template>
