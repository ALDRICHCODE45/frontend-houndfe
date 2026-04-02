<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { AxiosError } from 'axios'
import { computed, reactive, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { z } from 'zod'
import { productApi } from '../api/product.api'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import type {
  CreatePriceListPayload,
  DomainApiError,
  PriceList,
  TierPriceInput,
  UpdatePriceListPayload,
} from '../interfaces/product.types'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const props = defineProps<{
  productId: string
  canUpdate: boolean
  canDelete: boolean
}>()

const toast = useToast()
const queryClient = useQueryClient()

// ── Queries ────────────────────────────────────────────────

const { data: priceLists, isFetching } = useQuery({
  queryKey: computed(() => productQueryKeys.priceLists(props.productId)),
  queryFn: () => productApi.getPriceLists(props.productId),
  enabled: computed(() => props.productId.length > 0),
  refetchOnWindowFocus: false,
})

const lists = computed(() => priceLists.value ?? [])

// ── Currency helpers ───────────────────────────────────────

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function centsToDecimal(cents: number): string {
  return (Math.max(cents, 0) / 100).toFixed(2)
}

function decimalToCents(value: string): number {
  const normalized = value.replace(',', '.').trim()
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed)) return 0
  return Math.round(parsed * 100)
}

// ── Modal state ────────────────────────────────────────────

const isModalOpen = ref(false)
const editingList = ref<PriceList | null>(null)
const isEditing = computed(() => editingList.value !== null)
const isPublico = computed(() => editingList.value?.name === 'PUBLICO')

const priceRegex = /^\d+(?:[.,]\d{1,2})?$/

const formSchema = z.object({
  name: z
    .string({ required_error: 'El nombre es obligatorio' })
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(50, 'Máximo 50 caracteres'),
  price: z
    .string({ required_error: 'El precio es obligatorio' })
    .trim()
    .min(1, 'El precio es obligatorio')
    .regex(priceRegex, 'Ingresá un valor decimal válido (ej: 199.90)'),
})

type FormState = z.infer<typeof formSchema>

const formState = reactive<FormState>({
  name: '',
  price: '',
})

// ── Tier prices dynamic rows ───────────────────────────────

interface TierRow {
  key: number
  minQuantity: number | string
  price: string
}

const tierRows = ref<TierRow[]>([])
let tierKeyCounter = 0

function addTierRow() {
  tierRows.value.push({ key: tierKeyCounter++, minQuantity: '', price: '' })
}

function removeTierRow(index: number) {
  tierRows.value.splice(index, 1)
}

function buildTierPrices(): TierPriceInput[] {
  return tierRows.value
    .filter((row) => String(row.minQuantity).trim() !== '' && row.price.trim() !== '')
    .map((row) => ({
      minQuantity:
        typeof row.minQuantity === 'string'
          ? Number.parseInt(row.minQuantity, 10)
          : row.minQuantity,
      priceCents: decimalToCents(row.price),
    }))
    .sort((a, b) => a.minQuantity - b.minQuantity)
}

function tierRowsAreValid(): { valid: boolean; message?: string } {
  const built = buildTierPrices()
  const quantities = built.map((t) => t.minQuantity)
  const uniqueSet = new Set(quantities)

  if (uniqueSet.size !== quantities.length) {
    return { valid: false, message: 'Las cantidades mínimas deben ser únicas.' }
  }

  for (let i = 1; i < quantities.length; i++) {
    if (quantities[i]! <= quantities[i - 1]!) {
      return {
        valid: false,
        message: 'Las cantidades mínimas deben ser estrictamente ascendentes.',
      }
    }
  }

  for (const row of tierRows.value) {
    const qty = String(row.minQuantity).trim()
    if (qty !== '' && (Number.isNaN(Number(qty)) || Number(qty) < 0)) {
      return { valid: false, message: 'Las cantidades mínimas deben ser enteros >= 0.' }
    }
    if (row.price.trim() !== '' && !priceRegex.test(row.price.trim())) {
      return { valid: false, message: 'Los precios de escala deben ser decimales válidos.' }
    }
  }

  return { valid: true }
}

const tierError = ref('')

// ── Open modal ─────────────────────────────────────────────

function openCreate() {
  editingList.value = null
  formState.name = ''
  formState.price = ''
  tierRows.value = []
  tierKeyCounter = 0
  tierError.value = ''
  isModalOpen.value = true
}

function openEdit(list: PriceList) {
  editingList.value = list
  formState.name = list.name
  formState.price = centsToDecimal(list.priceCents)
  tierKeyCounter = 0
  tierRows.value = list.tierPrices.map((tp) => ({
    key: tierKeyCounter++,
    minQuantity: tp.minQuantity,
    price: centsToDecimal(tp.priceCents),
  }))
  tierError.value = ''
  isModalOpen.value = true
}

function closeModal() {
  isModalOpen.value = false
  editingList.value = null
  tierError.value = ''
}

// ── Mutations ──────────────────────────────────────────────

function mapDomainError(error: AxiosError<DomainApiError>): string {
  return error.response?.data?.message ?? 'No pudimos completar la operación. Reintentá.'
}

async function invalidatePriceLists() {
  await queryClient.invalidateQueries({ queryKey: productQueryKeys.priceLists(props.productId) })
}

const createMutation = useMutation({
  mutationFn: (payload: CreatePriceListPayload) =>
    productApi.createPriceList(props.productId, payload),
  onSuccess: async () => {
    closeModal()
    toast.add({
      title: 'Lista creada',
      description: 'La lista de precios se creó correctamente.',
      color: 'success',
    })
    await invalidatePriceLists()
  },
  onError: (error) => {
    toast.add({
      title: 'Error al crear lista',
      description: mapDomainError(error as AxiosError<DomainApiError>),
      color: 'error',
    })
  },
})

const updateMutation = useMutation({
  mutationFn: (params: { priceListId: string; payload: UpdatePriceListPayload }) =>
    productApi.updatePriceList(props.productId, params.priceListId, params.payload),
  onSuccess: async () => {
    closeModal()
    toast.add({
      title: 'Lista actualizada',
      description: 'Los cambios se guardaron correctamente.',
      color: 'success',
    })
    await invalidatePriceLists()
  },
  onError: (error) => {
    toast.add({
      title: 'Error al actualizar lista',
      description: mapDomainError(error as AxiosError<DomainApiError>),
      color: 'error',
    })
  },
})

const deleteMutation = useMutation({
  mutationFn: (priceListId: string) => productApi.removePriceList(props.productId, priceListId),
  onSuccess: async () => {
    toast.add({
      title: 'Lista eliminada',
      description: 'La lista fue eliminada correctamente.',
      color: 'success',
    })
    await invalidatePriceLists()
  },
  onError: (error) => {
    toast.add({
      title: 'Error al eliminar lista',
      description: mapDomainError(error as AxiosError<DomainApiError>),
      color: 'error',
    })
  },
})

const isSaving = computed(() => createMutation.isPending.value || updateMutation.isPending.value)

// ── Handlers ───────────────────────────────────────────────

function handleSubmit(event: FormSubmitEvent<FormState>) {
  const tierValidation = tierRowsAreValid()
  if (!tierValidation.valid) {
    tierError.value = tierValidation.message ?? 'Error en escalas de precios.'
    return
  }
  tierError.value = ''

  const tiers = buildTierPrices()
  const priceCents = decimalToCents(event.data.price)

  if (isEditing.value && editingList.value) {
    updateMutation.mutate({
      priceListId: editingList.value.id,
      payload: {
        priceCents,
        ...(tiers.length > 0 ? { tierPrices: tiers } : { tierPrices: [] }),
      },
    })
  } else {
    createMutation.mutate({
      name: event.data.name.trim(),
      priceCents,
      ...(tiers.length > 0 ? { tierPrices: tiers } : {}),
    })
  }
}

function handleDelete(list: PriceList) {
  if (list.name === 'PUBLICO') return
  const confirmed = window.confirm(`¿Querés eliminar la lista "${list.name}"?`)
  if (!confirmed) return
  deleteMutation.mutate(list.id)
}

function formatMargin(list: PriceList): string {
  if (!list.margin) return '—'
  const sign = list.margin.amountCents >= 0 ? '+' : ''
  return `${sign}${currencyFormatter.format(list.margin.amountDecimal)} (${list.margin.percent}%)`
}

function formatTierMargin(tier: { margin?: { amountDecimal?: number; percent?: number } }): string {
  if (!tier.margin) return ''
  const sign = (tier.margin.amountDecimal ?? 0) >= 0 ? '+' : ''
  return `${sign}${currencyFormatter.format(tier.margin.amountDecimal ?? 0)} (${tier.margin.percent ?? 0}%)`
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-xl font-semibold">Listas de Precios</h3>
          <p class="text-sm text-muted">Gestioná precios base y escalas por volumen.</p>
        </div>
        <UButton
          v-if="canUpdate"
          label="Nueva lista"
          icon="i-lucide-plus"
          size="sm"
          @click="openCreate"
        />
      </div>
    </template>

    <div class="flex flex-col gap-3">
      <div v-if="isFetching" class="text-sm text-muted">Cargando listas de precios...</div>

      <div v-else-if="lists.length === 0" class="text-sm text-muted">
        Sin listas de precios registradas.
      </div>

      <div v-else class="space-y-3">
        <div v-for="list in lists" :key="list.id" class="rounded-lg border border-default p-4">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="font-semibold text-base">{{ list.name }}</p>
                <UBadge v-if="list.name === 'PUBLICO'" color="primary" variant="subtle" size="xs">
                  Base
                </UBadge>
              </div>

              <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span class="tabular-nums font-medium">
                  {{ currencyFormatter.format(list.priceCents / 100) }}
                </span>
                <span class="text-muted">
                  Margen:
                  <span
                    class="font-medium"
                    :class="(list.margin?.amountCents ?? 0) >= 0 ? 'text-success' : 'text-error'"
                    >{{ formatMargin(list) }}</span
                  >
                </span>
              </div>

              <!-- Tier prices -->
              <div v-if="list.tierPrices.length > 0" class="mt-3">
                <p class="text-xs uppercase text-muted mb-1.5">Precios por volumen</p>
                <div class="flex flex-wrap gap-2">
                  <div
                    v-for="tier in list.tierPrices"
                    :key="tier.id"
                    class="inline-flex items-center gap-1.5 rounded-md bg-elevated px-2.5 py-1.5 text-sm"
                  >
                    <span class="text-muted">{{ tier.minQuantity }}+ uds:</span>
                    <span class="font-medium tabular-nums">{{
                      currencyFormatter.format(tier.priceCents / 100)
                    }}</span>
                    <span
                      v-if="tier.margin"
                      class="text-xs"
                      :class="(tier.margin?.amountCents ?? 0) >= 0 ? 'text-success' : 'text-error'"
                    >
                      {{ formatTierMargin(tier) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <UButton
                v-if="canUpdate"
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="openEdit(list)"
              />
              <UButton
                v-if="canDelete && list.name !== 'PUBLICO'"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                :loading="deleteMutation.isPending.value"
                @click="handleDelete(list)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </UCard>

  <!-- Create / Edit Modal -->
  <UModal
    v-model:open="isModalOpen"
    :title="isEditing ? `Editar lista: ${editingList?.name}` : 'Nueva lista de precios'"
    :content="{ class: 'sm:max-w-xl' }"
  >
    <template #body>
      <UForm
        id="price-list-form"
        :schema="formSchema"
        :state="formState"
        class="flex flex-col gap-4"
        @submit="handleSubmit"
      >
        <UFormField label="Nombre" name="name">
          <UInput
            v-model="formState.name"
            placeholder="Ej: Mayoreo"
            :disabled="isSaving || isPublico"
            size="lg"
          />
        </UFormField>

        <UFormField label="Precio base" name="price">
          <UInput v-model="formState.price" placeholder="199.90" :disabled="isSaving" size="lg">
            <template #leading>
              <span class="text-sm text-muted">$</span>
            </template>
          </UInput>
        </UFormField>

        <!-- Tier Prices -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">Precios por volumen</p>
            <UButton
              type="button"
              label="Agregar escala"
              icon="i-lucide-plus"
              size="xs"
              variant="outline"
              :disabled="isSaving"
              @click="addTierRow"
            />
          </div>

          <div v-if="tierRows.length === 0" class="text-sm text-muted">
            Sin escalas de precio. Agregá una para ofrecer descuentos por cantidad.
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="(row, index) in tierRows"
              :key="row.key"
              class="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
            >
              <UFormField :label="index === 0 ? 'Cantidad mínima' : undefined">
                <UInputNumber
                  v-model="row.minQuantity"
                  placeholder="0"
                  :min="0"
                  :disabled="isSaving"
                  class="w-full"
                />
              </UFormField>

              <UFormField :label="index === 0 ? 'Precio' : undefined">
                <UInput v-model="row.price" placeholder="150.00" :disabled="isSaving">
                  <template #leading>
                    <span class="text-sm text-muted">$</span>
                  </template>
                </UInput>
              </UFormField>

              <UButton
                icon="i-lucide-x"
                color="error"
                variant="ghost"
                size="xs"
                :disabled="isSaving"
                class="mb-0.5"
                @click="removeTierRow(index)"
              />
            </div>
          </div>

          <p v-if="tierError" class="text-sm text-error">{{ tierError }}</p>
        </div>
      </UForm>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="outline"
          :disabled="isSaving"
          @click="closeModal"
        />
        <UButton
          :label="isEditing ? 'Guardar cambios' : 'Crear lista'"
          type="submit"
          form="price-list-form"
          :loading="isSaving"
        />
      </div>
    </template>
  </UModal>
</template>
