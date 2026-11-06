<script setup lang="ts">
/**
 * ShippingOriginPanel — the Origen tab (handoff §6). Loading, error, not
 * configured («Configurar origen» for editors) and the address: a form for
 * update:ShippingSettings, a description list otherwise (S6).
 */
import { computed, shallowRef, watch } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import { useShippingOrigin } from '../composables/useShippingOrigin'
import {
  draftToOriginBody,
  mapOriginError,
  originToDraft,
  type OriginDraft,
  type OriginErrors,
} from '../utils/shippingOriginForm'
import ShippingOriginForm from './ShippingOriginForm.vue'

const props = defineProps<{ tenantId: string; canUpdate: boolean }>()
const emit = defineEmits<{ dirty: [dirty: boolean] }>()

const toast = useToast()
const { query, save } = useShippingOrigin(() => props.tenantId, () => true)

const configuring = shallowRef(false)
const formKey = shallowRef(0)
const serverErrors = shallowRef<OriginErrors>({})
const message = shallowRef<string | null>(null)
const dirty = shallowRef(false)
watch(dirty, (value) => emit('dirty', value), { immediate: true })

const response = computed(() => query.data.value)
const origin = computed(() => (response.value?.configured ? response.value.origin : null))
const showForm = computed(() => props.canUpdate && (origin.value !== null || configuring.value))
const initial = computed(() => originToDraft(origin.value))

const readRows = computed(() => {
  const value = origin.value
  if (!value) return []
  return [
    { label: 'Calle y número', value: value.addressLine1, wide: true },
    ...(value.addressLine2 ? [{ label: 'Interior o referencia', value: value.addressLine2, wide: true }] : []),
    { label: 'Colonia', value: value.neighborhood },
    { label: 'Alcaldía o municipio', value: value.municipality },
    { label: 'Estado', value: value.state },
    { label: 'Código postal', value: value.postalCode },
    { label: 'Teléfono de contacto', value: value.contactPhone },
  ]
})

function configure() {
  configuring.value = true
  formKey.value++
}

async function onSave(draft: OriginDraft) {
  serverErrors.value = {}
  message.value = null
  try {
    await save.mutateAsync(draftToOriginBody(draft))
    configuring.value = false
    dirty.value = false
    formKey.value++
    toast.add({ title: 'Origen guardado', color: 'success' })
  } catch (err) {
    const mapped = mapOriginError(err)
    serverErrors.value = mapped.fields
    message.value = mapped.message
  }
}

function onDiscard() {
  serverErrors.value = {}
  message.value = null
  if (!origin.value) configuring.value = false
}
</script>

<template>
  <section class="shipping-panel" aria-labelledby="shipping-origin-title">
    <div class="shipping-panel__head">
      <h2 id="shipping-origin-title" class="shipping-panel__title">Origen de envíos</h2>
    </div>

    <div v-if="query.isLoading.value" data-testid="origin-loading" class="shipping-panel__skeleton" aria-busy="true">
      <USkeleton class="h-5 w-48" />
      <USkeleton class="h-11 w-full" />
      <USkeleton class="h-11 w-full" />
      <USkeleton class="h-11 w-2/3" />
    </div>

    <EmptyState
      v-else-if="query.isError.value"
      kind="error"
      title="No se pudo cargar el origen"
      action-label="Reintentar"
      action-test-id="origin-retry"
      :action-loading="query.isFetching.value"
      @action="query.refetch()"
    />

    <ShippingOriginForm
      v-else-if="showForm"
      :key="formKey"
      :initial="initial"
      :creating="origin === null"
      :saving="save.isPending.value"
      :saved-at="origin?.updatedAt ?? null"
      :server-errors="serverErrors"
      :message="message"
      @save="onSave"
      @discard="onDiscard"
      @dirty="dirty = $event"
    />

    <EmptyState
      v-else-if="!origin"
      title="Aún no hay origen de envíos"
      description="Es la dirección donde la paquetería recoge los pedidos."
      :action-label="canUpdate ? 'Configurar origen' : undefined"
      action-test-id="origin-configure"
      action-variant="solid"
      @action="configure"
    />

    <div v-else class="shipping-panel__surface">
      <dl class="origin-read">
        <div v-for="row in readRows" :key="row.label" class="origin-read__row" :class="{ 'origin-read__row--wide': row.wide }">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.shipping-panel { display: grid; gap: 16px; min-width: 0; }
.shipping-panel__head { display: flex; align-items: center; min-height: 44px; }
.shipping-panel__title { color: var(--hf-heading); font-size: 16px; font-weight: 600; }
.shipping-panel__skeleton, .shipping-panel__surface { display: grid; gap: 12px; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); padding: 24px; }
.origin-read { display: grid; gap: 16px; }
.origin-read__row { display: grid; gap: 2px; min-width: 0; }
.origin-read dt { color: var(--hf-muted); font-size: 13px; }
.origin-read dd { overflow-wrap: anywhere; color: var(--hf-ink); font-size: 14px; }
@media (min-width: 768px) {
  .origin-read { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .origin-read__row--wide { grid-column: 1 / -1; }
}
@media (max-width: 767px) {
  .shipping-panel__skeleton, .shipping-panel__surface { padding: 16px; }
}
</style>
