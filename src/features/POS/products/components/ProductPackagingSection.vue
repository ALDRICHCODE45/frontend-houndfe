<script setup lang="ts">
/**
 * ProductPackagingSection — «Empaque para envío» in the product's
 * Presentaciones (S3): the packed item's weight and outer size that carrier
 * quotes need. It loads, saves and removes its own sub-resource; it is not part
 * of the product form and its header save.
 *
 * States: loading (skeleton), error (Reintentar), empty (with «Agregar
 * empaque» only with update:Product), data (summary with Editar / Quitar), and
 * the editor with its own «Guardar empaque».
 *
 * Props:
 *   productId — the saved product
 *   canUpdate — update:Product: edit and remove
 */
import { computed, ref, shallowRef } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import { useConfirm } from '@/core/shared/composables/useConfirm'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import PackagingFields from './PackagingFields.vue'
import { useProductPackaging } from '../composables/useProductPackaging'
import {
  formatPackagingSize,
  formatPackagingWeight,
  packagingErrorMessages,
  packagingToForm,
  readPackagingForm,
  type PackagingFieldErrors,
  type PackagingFormInput,
} from '../utils/product-packaging-form'

declare const useToast: () => {
  add: (options: { title: string; description?: string; color?: 'success' | 'error' }) => void
}

const props = defineProps<{
  productId: string
  canUpdate: boolean
}>()

const toast = useToast()
const { confirm } = useConfirm()
const { packaging, isLoading, isError, isFetching, refetch, save, remove } = useProductPackaging(
  () => props.productId,
)

const editing = shallowRef(false)
const form = ref<PackagingFormInput>(packagingToForm(null))
const fieldErrors = ref<PackagingFieldErrors>({})
const formError = shallowRef('')

const summary = computed(() =>
  packaging.value
    ? {
        weight: formatPackagingWeight(packaging.value.weightG),
        size: formatPackagingSize(packaging.value),
        updatedAt: formatShortDateTime(packaging.value.updatedAt),
      }
    : null,
)
const saving = computed(() => save.isPending.value)

function startEditing() {
  form.value = packagingToForm(packaging.value)
  fieldErrors.value = {}
  formError.value = ''
  editing.value = true
}

function cancelEditing() {
  editing.value = false
}

async function submit() {
  const { body, errors } = readPackagingForm(form.value)
  fieldErrors.value = errors
  formError.value = ''
  if (!body) return
  try {
    await save.mutateAsync(body)
    editing.value = false
    toast.add({ title: 'Empaque guardado', color: 'success' })
  } catch (err) {
    const mapped = packagingErrorMessages(err, 'product')
    fieldErrors.value = mapped.fields
    formError.value = mapped.message
  }
}

async function removePackaging() {
  const accepted = await confirm({
    title: '¿Quitar el empaque?',
    description: 'Sin peso y medidas no se pueden cotizar envíos de este producto.',
    confirmLabel: 'Quitar empaque',
    tone: 'danger',
  })
  if (!accepted) return
  try {
    await remove.mutateAsync()
    toast.add({ title: 'Empaque quitado', color: 'success' })
  } catch (err) {
    toast.add({ title: 'No se pudo quitar el empaque', description: packagingErrorMessages(err, 'product').message, color: 'error' })
  }
}
</script>

<template>
  <UCard data-testid="product-packaging-section">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-base font-semibold">Empaque para envío</h2>
        <div v-if="summary && !editing && canUpdate" class="flex items-center gap-2">
          <UButton
            label="Quitar"
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            :loading="remove.isPending.value"
            data-testid="packaging-remove"
            @click="removePackaging"
          />
          <UButton
            label="Editar"
            icon="i-lucide-pencil"
            color="neutral"
            variant="outline"
            data-testid="packaging-edit"
            @click="startEditing"
          />
        </div>
      </div>
    </template>

    <div v-if="isLoading" class="grid gap-3 sm:grid-cols-2" aria-busy="true" data-testid="packaging-loading">
      <USkeleton class="h-11 w-full" />
      <USkeleton class="h-11 w-full" />
    </div>

    <EmptyState
      v-else-if="isError && packaging === undefined"
      kind="error"
      title="No se pudo cargar el empaque"
      action-label="Reintentar"
      action-test-id="packaging-retry"
      :action-loading="isFetching"
      @action="refetch()"
    />

    <form v-else-if="editing" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <PackagingFields
        v-model="form"
        id-prefix="product-packaging"
        :errors="fieldErrors"
        :disabled="saving"
      />
      <p
        v-if="formError"
        class="text-sm text-[var(--hf-danger)]"
        role="alert"
        data-testid="packaging-form-error"
      >
        {{ formError }}
      </p>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          class="justify-center"
          :disabled="saving"
          @click="cancelEditing"
        />
        <UButton
          type="submit"
          label="Guardar empaque"
          class="hf-primary-control justify-center"
          :loading="saving"
          data-testid="packaging-save"
        />
      </div>
    </form>

    <dl
      v-else-if="summary"
      class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[max-content_1fr]"
      data-testid="packaging-summary"
    >
      <div class="contents">
        <dt class="text-muted">Peso</dt>
        <dd class="font-semibold tabular-nums text-highlighted">{{ summary.weight }}</dd>
      </div>
      <div class="contents">
        <dt class="text-muted">Medidas (largo × ancho × alto)</dt>
        <dd class="font-semibold tabular-nums text-highlighted">{{ summary.size }}</dd>
      </div>
      <div class="contents">
        <dt class="text-muted">Actualizado</dt>
        <dd class="text-muted">{{ summary.updatedAt }}</dd>
      </div>
    </dl>

    <EmptyState
      v-else
      title="Sin empaque registrado"
      description="Las cotizaciones de envío necesitan el peso y las medidas."
      icon="i-lucide-package"
      :action-label="canUpdate ? 'Agregar empaque' : undefined"
      action-icon="i-lucide-plus"
      action-test-id="packaging-add"
      @action="startEditing"
    />
  </UCard>
</template>
