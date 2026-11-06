<script setup lang="ts">
/**
 * VariantPackagingModal — The packaging a saved variant uses (S3), opened from
 * its ⋮ menu. It shows the effective record, with «Heredado del producto» when
 * the variant inherits, and with update:Product lets the user choose between
 * «Usar el empaque del producto» (DELETE the override) and «Empaque propio»
 * (PUT a whole record; there is no per-field inheritance).
 *
 * Props:
 *   open (v-model) — reads only while open
 *   productId, variantId — the saved records (never shown)
 *   variantLabel — the variant's readable name, for the title
 *   canUpdate — update:Product: choose and save
 */
import { computed, ref, shallowRef, watch } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import PackagingFields from './PackagingFields.vue'
import { useVariantPackaging } from '../composables/useProductPackaging'
import type { PackagingRecord } from '../interfaces/product-packaging.types'
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

type Choice = 'product' | 'own'

const props = defineProps<{
  productId: string
  variantId: string
  variantLabel: string
  canUpdate: boolean
}>()

const open = defineModel<boolean>('open', { required: true })

const toast = useToast()
const { data, isLoading, isError, refetch, save, remove } = useVariantPackaging(
  () => props.productId,
  () => props.variantId,
  { enabled: open },
)

const choice = shallowRef<Choice>('product')
const form = ref<PackagingFormInput>(packagingToForm(null))
const fieldErrors = ref<PackagingFieldErrors>({})
const formError = shallowRef('')

// Each opening (or a fresh read) starts from what the variant uses today.
watch(
  () => [open.value, data.value] as const,
  ([isOpen, current]) => {
    if (!isOpen || !current) return
    choice.value = current.source === 'VARIANT' ? 'own' : 'product'
    form.value = packagingToForm(current.override ?? current.effective)
    fieldErrors.value = {}
    formError.value = ''
  },
  { immediate: true },
)

function describe(record: PackagingRecord | null | undefined): string {
  return record ? `${formatPackagingWeight(record.weightG)} · ${formatPackagingSize(record)}` : ''
}

const effectiveText = computed(() => describe(data.value?.effective))
const inherits = computed(() => data.value?.source === 'PRODUCT')

const choiceItems = computed(() => [
  {
    value: 'product',
    label: 'Usar el empaque del producto',
    description: data.value?.productPackaging
      ? describe(data.value.productPackaging)
      : 'El producto aún no tiene empaque.',
  },
  { value: 'own', label: 'Empaque propio', description: 'Peso y medidas solo para esta variante.' },
])

const busy = computed(() => save.isPending.value || remove.isPending.value)
// Choosing to inherit while it already inherits changes nothing.
const nothingToSave = computed(() => choice.value === 'product' && data.value?.source !== 'VARIANT')

function onChoice(value: unknown) {
  choice.value = value === 'own' ? 'own' : 'product'
  fieldErrors.value = {}
  formError.value = ''
}

async function submit() {
  formError.value = ''
  try {
    if (choice.value === 'product') {
      await remove.mutateAsync()
      toast.add({ title: 'La variante usa el empaque del producto', color: 'success' })
    } else {
      const { body, errors } = readPackagingForm(form.value)
      fieldErrors.value = errors
      if (!body) return
      await save.mutateAsync(body)
      toast.add({ title: 'Empaque de la variante guardado', color: 'success' })
    }
    open.value = false
  } catch (err) {
    const mapped = packagingErrorMessages(err, 'variant')
    fieldErrors.value = mapped.fields
    formError.value = mapped.message
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`Empaque de ${variantLabel}`"
    :content="{ class: 'hf-theme hf-ui sm:max-w-xl' }"
  >
    <template #body>
      <div v-if="isLoading" class="flex flex-col gap-3" aria-busy="true" data-testid="variant-packaging-loading">
        <USkeleton class="h-14 w-full" />
        <USkeleton class="h-20 w-full" />
      </div>

      <EmptyState
        v-else-if="isError && !data"
        kind="error"
        title="No se pudo cargar el empaque"
        action-label="Reintentar"
        action-test-id="variant-packaging-retry"
        @action="refetch()"
      />

      <form v-else-if="data" class="flex flex-col gap-5" novalidate @submit.prevent="submit">
        <section
          class="rounded-md border border-default bg-elevated/20 p-3"
          aria-labelledby="variant-packaging-effective-title"
          data-testid="variant-packaging-effective"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 id="variant-packaging-effective-title" class="text-sm font-semibold text-highlighted">
              Empaque que usa hoy
            </h3>
            <StatusBadge v-if="inherits" label="Heredado del producto" tone="info" aria-prefix="Origen:" />
          </div>
          <p v-if="effectiveText" class="mt-1 text-sm tabular-nums text-default">{{ effectiveText }}</p>
          <p v-else class="mt-1 text-sm text-muted">Sin empaque: ni la variante ni el producto lo tienen.</p>
        </section>

        <template v-if="canUpdate">
          <URadioGroup
            :model-value="choice"
            legend="¿Qué empaque usa esta variante?"
            variant="card"
            :items="choiceItems"
            :disabled="busy"
            data-testid="variant-packaging-choice"
            @update:model-value="onChoice"
          />

          <PackagingFields
            v-if="choice === 'own'"
            v-model="form"
            id-prefix="variant-packaging"
            :errors="fieldErrors"
            :disabled="busy"
          />

          <p
            v-if="formError"
            class="text-sm text-[var(--hf-danger)]"
            role="alert"
            data-testid="variant-packaging-error"
          >
            {{ formError }}
          </p>

          <div class="flex justify-end">
            <UButton
              type="submit"
              label="Guardar"
              class="hf-primary-control w-full justify-center sm:w-auto"
              :loading="busy"
              :disabled="nothingToSave"
              data-testid="variant-packaging-save"
            />
          </div>
        </template>
      </form>
    </template>
  </UModal>
</template>
