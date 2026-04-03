<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { AxiosError } from 'axios'
import { computed, reactive, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { z } from 'zod'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import { productApi } from '../api/product.api'
import { currencyFormatter } from '@/core/shared/utils/currency.utils'
import { mapDomainError, type DomainApiError } from '@/core/shared/utils/error.utils'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import type { PriceList, TierPriceInput, UpdatePriceListPayload } from '../interfaces/product.types'

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

// ── Inline price editing ──────────────────────────────────

const inlinePriceInputs = reactive<Record<string, string>>({})

function syncInlinePriceInputs(nextLists: PriceList[]) {
  const currentIds = new Set(nextLists.map((l) => l.id))
  for (const id of Object.keys(inlinePriceInputs)) {
    if (!currentIds.has(id)) delete inlinePriceInputs[id]
  }
  for (const list of nextLists) {
    inlinePriceInputs[list.id] = centsToDecimal(list.priceCents)
  }
}

watch(() => lists.value, syncInlinePriceInputs, { immediate: true })

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
const confirmState = ref({
  open: false,
  description: '',
  onConfirm: () => {},
})

function openConfirm(description: string, onConfirm: () => void) {
  confirmState.value = { open: true, description, onConfirm }
}

function handleConfirm() {
  confirmState.value.onConfirm()
  confirmState.value.open = false
}

const priceRegex = /^\d+(?:[.,]\d{1,2})?$/

const formSchema = z.object({
  name: z
    .string({ required_error: 'El nombre es obligatorio' })
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(50, 'Máximo 50 caracteres'),
  price: z.string().trim().default(''),
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

function closeModal() {
  isModalOpen.value = false
  editingList.value = null
  tierError.value = ''
}

// ── Mutations ──────────────────────────────────────────────

async function invalidatePriceLists() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: productQueryKeys.priceLists(props.productId) }),
    queryClient.invalidateQueries({ queryKey: productQueryKeys.globalPriceLists() }),
    queryClient.invalidateQueries({ queryKey: productQueryKeys.variants(props.productId) }),
    queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(props.productId) }),
  ])
}

const createMutation = useMutation({
  mutationFn: (name: string) => productApi.createGlobalPriceList({ name }),
  onSuccess: async () => {
    closeModal()
    toast.add({
      title: 'Lista creada',
      description: 'La lista de precios se creó y está disponible en todos los productos.',
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

const isSaving = computed(() => createMutation.isPending.value || updateMutation.isPending.value)

const deleteMutation = useMutation({
  mutationFn: (priceListId: string) => productApi.removeGlobalPriceList(priceListId),
  onSuccess: async () => {
    toast.add({
      title: 'Lista eliminada',
      description: 'La lista de precios fue eliminada correctamente.',
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
    createMutation.mutate(event.data.name.trim())
  }
}

function handleInlinePriceSave(list: PriceList) {
  if (!props.canUpdate) return
  const rawInput = inlinePriceInputs[list.id] ?? centsToDecimal(list.priceCents)
  const nextPriceCents = decimalToCents(rawInput)
  if (nextPriceCents === list.priceCents) return

  const tierPricesPayload =
    list.tierPrices.length > 0
      ? list.tierPrices.map((t) => ({ minQuantity: t.minQuantity, priceCents: t.priceCents }))
      : undefined

  updateMutation.mutate({
    priceListId: list.id,
    payload: {
      priceCents: nextPriceCents,
      ...(tierPricesPayload ? { tierPrices: tierPricesPayload } : {}),
    },
  })
}

function handleDeletePriceList(list: PriceList) {
  if (!props.canDelete) return

  openConfirm(`¿Querés eliminar la lista de precios ${list.name}?`, () => {
    void deleteMutation.mutateAsync(list.id)
  })
}

// ── Tier price modal (from table "+" button) ──────────────

const isTierModalOpen = ref(false)
const selectedList = ref<PriceList | null>(null)
const tierModalRows = ref<TierRow[]>([])
let tierModalKeyCounter = 0

function openTierModal(list: PriceList) {
  selectedList.value = list
  tierModalKeyCounter = 0
  tierModalRows.value = list.tierPrices.map((tier) => ({
    key: tierModalKeyCounter++,
    minQuantity: tier.minQuantity,
    price: centsToDecimal(tier.priceCents),
  }))
  if (tierModalRows.value.length === 0) {
    tierModalRows.value.push({
      key: tierModalKeyCounter++,
      minQuantity: 0,
      price: centsToDecimal(list.priceCents),
    })
  }
  isTierModalOpen.value = true
}

function closeTierModal() {
  isTierModalOpen.value = false
  selectedList.value = null
  tierModalRows.value = []
}

function addTierModalRow() {
  tierModalRows.value.push({ key: tierModalKeyCounter++, minQuantity: '', price: '' })
}

function removeTierModalRow(index: number) {
  tierModalRows.value.splice(index, 1)
  if (tierModalRows.value.length === 0) addTierModalRow()
}

function handleSaveTierModal() {
  if (!props.canUpdate || !selectedList.value) return

  const filledRows = tierModalRows.value
    .filter((row) => String(row.minQuantity).trim() !== '' && row.price.trim() !== '')
    .map((row) => ({
      minQuantity:
        typeof row.minQuantity === 'string'
          ? Number.parseInt(row.minQuantity, 10)
          : row.minQuantity,
      priceCents: decimalToCents(row.price),
    }))
    .sort((a, b) => a.minQuantity - b.minQuantity)

  const hasInvalidQty = filledRows.some(
    (row) => !Number.isInteger(row.minQuantity) || row.minQuantity < 0,
  )
  if (hasInvalidQty) {
    toast.add({
      title: 'Cantidad inválida',
      description: 'Las cantidades deben ser enteros >= 0.',
      color: 'warning',
    })
    return
  }

  const quantitySet = new Set(filledRows.map((row) => row.minQuantity))
  if (quantitySet.size !== filledRows.length) {
    toast.add({
      title: 'Cantidades repetidas',
      description: 'No se pueden repetir cantidades.',
      color: 'warning',
    })
    return
  }

  const currentPriceInput =
    inlinePriceInputs[selectedList.value.id] ?? centsToDecimal(selectedList.value.priceCents)

  updateMutation.mutate(
    {
      priceListId: selectedList.value.id,
      payload: {
        priceCents: decimalToCents(currentPriceInput),
        tierPrices: filledRows,
      },
    },
    { onSuccess: () => closeTierModal() },
  )
}

function shouldShowMargin(list: PriceList): boolean {
  return list.priceCents > 0 && Boolean(list.margin)
}

function marginClass(list: PriceList): string {
  return (list.margin?.amountCents ?? 0) >= 0 ? 'text-success' : 'text-error'
}

function formatMarginPercent(list: PriceList): string {
  if (!shouldShowMargin(list)) return '--'
  return `${list.margin?.percent ?? 0}%`
}

function formatMarginAmount(list: PriceList): string {
  if (!shouldShowMargin(list)) return '--'
  return `${currencyFormatter.format(list.margin?.amountDecimal ?? 0)} por Unidad`
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Precios de Venta</h2>
      </div>
    </template>

    <div class="rounded-md border border-default">
      <table class="min-w-full divide-y divide-default text-sm">
        <thead class="bg-elevated/40">
          <tr>
            <th class="px-4 py-3 text-left font-medium">Lista de Precios</th>
            <th class="px-4 py-3 text-left font-medium">
              Precio de Venta
              <span class="block text-xs font-normal text-muted">(Con Impuestos Incluidos)</span>
            </th>
            <th class="px-4 py-3 text-center font-medium">+</th>
            <th class="px-4 py-3 text-left font-medium">Márgen</th>
            <th class="px-4 py-3 text-left font-medium">Ganancia</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-default">
          <tr v-if="isFetching">
            <td colspan="5" class="px-4 py-3 text-muted">Cargando listas de precios...</td>
          </tr>

          <tr v-else-if="lists.length === 0">
            <td colspan="5" class="px-4 py-3 text-muted">Sin listas de precios registradas.</td>
          </tr>

          <template v-else>
            <template v-for="list in lists" :key="list.id">
              <!-- Main price row -->
              <tr>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-medium">{{ list.name }}</span>
                    <UButton
                      v-if="canDelete"
                      type="button"
                      label="Eliminar"
                      color="error"
                      variant="ghost"
                      size="xs"
                      :loading="deleteMutation.isPending.value"
                      @click="handleDeletePriceList(list)"
                    />
                  </div>
                </td>

                <td class="px-4 py-3">
                  <div class="relative max-w-xs">
                    <span
                      class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted"
                      >$</span
                    >
                    <UInput
                      v-model="inlinePriceInputs[list.id]"
                      class="w-full"
                      inputmode="decimal"
                      placeholder="0.00"
                      :ui="{ base: 'pl-7' }"
                      :disabled="!canUpdate"
                      @blur="handleInlinePriceSave(list)"
                      @keyup.enter="handleInlinePriceSave(list)"
                    />
                  </div>
                </td>

                <td class="px-4 py-3 text-center">
                  <UButton
                    type="button"
                    icon="i-lucide-plus"
                    color="neutral"
                    variant="outline"
                    size="xs"
                    :disabled="!canUpdate"
                    @click="openTierModal(list)"
                  />
                </td>

                <td class="px-4 py-3" :class="shouldShowMargin(list) ? marginClass(list) : ''">
                  {{ formatMarginPercent(list) }}
                </td>

                <td class="px-4 py-3" :class="shouldShowMargin(list) ? marginClass(list) : ''">
                  {{ formatMarginAmount(list) }}
                </td>
              </tr>

              <!-- Tier prices sub-rows -->
              <template v-if="list.tierPrices.length > 0">
                <tr v-for="tier in list.tierPrices" :key="tier.id" class="bg-elevated/20">
                  <td class="py-2 pl-8 pr-4 text-sm text-muted">{{ tier.minQuantity }} o más</td>
                  <td class="px-4 py-2">
                    <span class="text-sm">
                      $ {{ centsToDecimal(tier.priceCents) }}
                      <span class="text-xs text-muted">por Unidad</span>
                    </span>
                  </td>
                  <td />
                  <td
                    class="px-4 py-2 text-sm"
                    :class="
                      tier.margin
                        ? (tier.margin.amountCents ?? 0) >= 0
                          ? 'text-success'
                          : 'text-error'
                        : ''
                    "
                  >
                    {{ tier.margin ? `${tier.margin.percent}%` : '--' }}
                  </td>
                  <td
                    class="px-4 py-2 text-sm"
                    :class="
                      tier.margin
                        ? (tier.margin.amountCents ?? 0) >= 0
                          ? 'text-success'
                          : 'text-error'
                        : ''
                    "
                  >
                    {{
                      tier.margin
                        ? `${currencyFormatter.format(tier.margin.amountDecimal ?? 0)} por Unidad`
                        : '--'
                    }}
                  </td>
                </tr>
                <tr class="bg-elevated/20">
                  <td colspan="5" class="px-4 py-2">
                    <UButton
                      type="button"
                      label="Editar Cantidades"
                      icon="i-lucide-pencil"
                      color="neutral"
                      variant="outline"
                      size="xs"
                      :disabled="!canUpdate"
                      @click="openTierModal(list)"
                    />
                  </td>
                </tr>
              </template>
            </template>
          </template>
        </tbody>
      </table>
    </div>

    <div class="mt-3">
      <UButton
        v-if="canUpdate"
        label="Agregar Lista de Precios"
        icon="i-lucide-plus"
        color="primary"
        variant="link"
        size="sm"
        @click="openCreate"
      />
    </div>
  </UCard>

  <!-- Create list modal (global) -->
  <UModal
    v-model:open="isModalOpen"
    :title="isEditing ? `Editar lista: ${editingList?.name}` : 'Nueva lista de precios'"
    :content="{ class: 'sm:max-w-md' }"
  >
    <template #body>
      <UForm
        id="price-list-form"
        :schema="formSchema"
        :state="formState"
        class="flex flex-col gap-4"
        @submit="handleSubmit"
      >
        <UFormField v-if="!isEditing" label="Nombre" name="name">
          <UInput
            v-model="formState.name"
            placeholder="Ej: Mayoreo"
            :disabled="isSaving"
            size="lg"
          />
        </UFormField>

        <template v-if="isEditing">
          <UFormField label="Precio base" name="price">
            <UInput v-model="formState.price" placeholder="199.90" :disabled="isSaving" size="lg">
              <template #leading>
                <span class="text-sm text-muted">$</span>
              </template>
            </UInput>
          </UFormField>

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
              Sin escalas de precio.
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
        </template>
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

  <!-- Tier prices modal (from table "+" button) -->
  <UModal
    v-model:open="isTierModalOpen"
    title="Precios por Cantidad"
    :content="{ class: 'sm:max-w-3xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-medium">{{ selectedList?.name }}</span>
        </div>

        <div class="space-y-3">
          <div
            v-for="(row, index) in tierModalRows"
            :key="row.key"
            class="grid grid-cols-1 gap-3 rounded-md border border-default p-3 md:grid-cols-[1fr_1fr_auto]"
          >
            <div class="flex items-center gap-2">
              <UInputNumber v-model="row.minQuantity" :min="0" class="flex-1" />
              <span class="shrink-0 text-xs text-muted">o más</span>
            </div>

            <div class="relative">
              <span
                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted"
                >$</span
              >
              <UInput
                v-model="row.price"
                inputmode="decimal"
                class="w-full"
                :ui="{ base: 'pl-7 pr-24' }"
              />
              <span
                class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted"
                >por Unidad</span
              >
            </div>

            <div class="flex justify-end md:justify-center">
              <UButton
                type="button"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                :disabled="tierModalRows.length === 1 && index === 0"
                @click="removeTierModalRow(index)"
              />
            </div>
          </div>
        </div>

        <UButton
          type="button"
          label="+ Agregar"
          color="neutral"
          variant="outline"
          @click="addTierModalRow"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton
          type="button"
          label="Cancelar"
          color="neutral"
          variant="outline"
          :disabled="updateMutation.isPending.value"
          @click="closeTierModal"
        />
        <UButton
          type="button"
          label="Guardar"
          :loading="updateMutation.isPending.value"
          @click="handleSaveTierModal"
        />
      </div>
    </template>
  </UModal>

  <ConfirmModal
    :open="confirmState.open"
    :description="confirmState.description"
    confirm-label="Eliminar"
    confirm-color="error"
    :loading="deleteMutation.isPending.value"
    @update:open="confirmState.open = $event"
    @confirm="handleConfirm"
  />
</template>
