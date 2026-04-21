<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { parseDate, CalendarDate } from '@internationalized/date'
import type { CustomerScope, DayOfWeek, PromotionFormState } from '../interfaces/promotion.types'
import { DAY_OPTIONS, CUSTOMER_SCOPE_OPTIONS } from '../composables/usePromotionForm'

// ── Props & emits ─────────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    modelValue: PromotionFormState
    mode: 'create' | 'edit'
  }>(),
  {
    mode: 'create',
  },
)

const emit = defineEmits<{
  'update:modelValue': [state: PromotionFormState]
}>()

// ── Field update helper ───────────────────────────────────────────────────────

function updateField<K extends keyof PromotionFormState>(key: K, value: PromotionFormState[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

// ── Customer search ───────────────────────────────────────────────────────────

const customerSearchQuery = ref('')

// Lazy-loaded customers (only when SPECIFIC scope is active)
const { data: customerResults } = useQuery({
  queryKey: ['customers-search', customerSearchQuery],
  queryFn: async () => {
    const { customerApi } = await import('@/features/POS/customers/api/customer.api')
    const result = await customerApi.getPaginated({
      pageIndex: 0,
      pageSize: 20,
      sorting: [{ id: 'firstName', desc: false }],
      globalFilter: customerSearchQuery.value,
    })
    return result.data ?? []
  },
  enabled: () =>
    props.modelValue.customerScope === 'SPECIFIC' && customerSearchQuery.value.length > 0,
})

// Map customers to SelectMenu format
const customerItems = computed(() =>
  (customerResults.value ?? []).map((customer) => ({
    value: customer.id,
    label: `${customer.firstName} ${customer.lastName ?? ''}`.trim(),
  })),
)

// ── Price list search ─────────────────────────────────────────────────────────

const { data: priceLists } = useQuery({
  queryKey: ['price-lists'],
  queryFn: async () => {
    const { productApi } = await import('@/features/POS/products/api/product.api')
    return productApi.getGlobalPriceLists()
  },
  enabled: () => props.modelValue.hasPriceLists,
})

// Map price lists to SelectMenu format
const priceListItems = computed(() =>
  (priceLists.value ?? []).map((pl) => ({
    value: pl.id,
    label: pl.name,
  })),
)

// ── Customer helpers ──────────────────────────────────────────────────────────

const selectedCustomers = computed({
  get: () => props.modelValue.customerIds,
  set: (value) => updateField('customerIds', value),
})

// ── Price list helpers ────────────────────────────────────────────────────────

const selectedPriceLists = computed({
  get: () => props.modelValue.priceListIds,
  set: (value) => updateField('priceListIds', value),
})

// ── Day of week helpers ───────────────────────────────────────────────────────

function toggleDay(day: DayOfWeek) {
  const current = props.modelValue.daysOfWeek
  const updated = current.includes(day) ? current.filter((d) => d !== day) : [...current, day]
  updateField('daysOfWeek', updated)
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Convert ISO string (YYYY-MM-DD) to CalendarDate for UCalendar */
function isoToCalendarDate(iso: string): CalendarDate | undefined {
  if (!iso) return undefined
  try {
    return parseDate(iso)
  } catch {
    return undefined
  }
}

/** Convert CalendarDate to ISO string (YYYY-MM-DD) */
function calendarDateToIso(date: CalendarDate | undefined): string {
  if (!date) return ''
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

/** Format CalendarDate for display */
function formatCalendarDate(date: CalendarDate | undefined): string {
  if (!date) return ''
  return new Intl.DateTimeFormat('es-AR', { year: 'numeric', month: 'long', day: 'numeric' }).format(
    new Date(date.year, date.month - 1, date.day),
  )
}

const startDateCalendar = computed({
  get: () => isoToCalendarDate(props.modelValue.startDate),
  set: (value) => updateField('startDate', calendarDateToIso(value)),
})

const endDateCalendar = computed({
  get: () => isoToCalendarDate(props.modelValue.endDate),
  set: (value) => updateField('endDate', calendarDateToIso(value)),
})

const formattedStartDate = computed(() => formatCalendarDate(startDateCalendar.value))
const formattedEndDate = computed(() => formatCalendarDate(endDateCalendar.value))

// ── Expose for testing ────────────────────────────────────────────────────────

defineExpose({ updateField })
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- ── Card 1: Vigencia ──────────────────────────────────────────────── -->
    <UCard data-testid="vigencia-section">
      <template #header>
        <h3 class="font-semibold text-highlighted">Vigencia</h3>
      </template>

      <div class="flex flex-col gap-4">
        <UCheckbox
          :model-value="modelValue.hasVigencia"
          label="Limitar su uso a ciertas fechas"
          @update:model-value="updateField('hasVigencia', $event)"
        />

        <div v-if="modelValue.hasVigencia" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Fecha de inicio" name="startDate">
            <UPopover>
              <UButton
                :label="formattedStartDate || 'Seleccionar fecha'"
                icon="i-lucide-calendar"
                color="neutral"
                variant="outline"
                class="w-full justify-start"
                data-testid="start-date-input"
              />
              <template #content>
                <UCalendar v-model="startDateCalendar" />
              </template>
            </UPopover>
          </UFormField>

          <UFormField label="Fecha de fin" name="endDate">
            <UPopover>
              <UButton
                :label="formattedEndDate || 'Seleccionar fecha'"
                icon="i-lucide-calendar"
                color="neutral"
                variant="outline"
                class="w-full justify-start"
                data-testid="end-date-input"
              />
              <template #content>
                <UCalendar v-model="endDateCalendar" />
              </template>
            </UPopover>
          </UFormField>
        </div>
      </div>
    </UCard>

    <!-- ── Card 2: Condiciones adicionales ──────────────────────────────── -->
    <UCard data-testid="conditions-section">
      <template #header>
        <h3 class="font-semibold text-highlighted">Condiciones Adicionales</h3>
      </template>

      <div class="flex flex-col gap-5">
        <!-- Customer scope -->
        <div class="flex flex-col gap-3">
          <UCheckbox
            :model-value="modelValue.customerScope !== 'ALL'"
            label="Limitar a ciertos clientes"
            @update:model-value="
              updateField('customerScope', $event ? 'REGISTERED_ONLY' : 'ALL')
            "
          />

          <div v-if="modelValue.customerScope !== 'ALL'" class="pl-6 flex flex-col gap-3">
            <URadioGroup
              :model-value="modelValue.customerScope"
              :items="CUSTOMER_SCOPE_OPTIONS"
              value-key="value"
              label-key="label"
              @update:model-value="updateField('customerScope', $event as CustomerScope)"
            />

            <!-- Specific customer search -->
            <div
              v-if="modelValue.customerScope === 'SPECIFIC'"
              data-testid="customer-search-section"
              class="flex flex-col gap-2"
            >
              <USelectMenu
                v-model="selectedCustomers"
                v-model:query="customerSearchQuery"
                multiple
                :items="customerItems"
                value-key="value"
                placeholder="Buscar clientes..."
                searchable
                searchable-placeholder="Escribí para buscar..."
              />
            </div>
          </div>
        </div>

        <!-- Price lists -->
        <div class="flex flex-col gap-3">
          <UCheckbox
            :model-value="modelValue.hasPriceLists"
            label="Limitar a ciertas listas de precio"
            @update:model-value="updateField('hasPriceLists', $event)"
          />

          <div
            v-if="modelValue.hasPriceLists"
            data-testid="price-lists-select"
            class="pl-6 flex flex-col gap-2"
          >
            <USelectMenu
              v-if="priceListItems.length > 0"
              v-model="selectedPriceLists"
              multiple
              :items="priceListItems"
              value-key="value"
              placeholder="Seleccionar listas de precio"
              searchable
              searchable-placeholder="Buscar..."
            />
            <p v-else class="text-sm text-muted">Cargando listas de precio...</p>
          </div>
        </div>

        <!-- Days of week -->
        <div class="flex flex-col gap-3">
          <UCheckbox
            :model-value="modelValue.hasDaysOfWeek"
            label="Limitar a ciertos días de la semana"
            @update:model-value="updateField('hasDaysOfWeek', $event)"
          />

          <div
            v-if="modelValue.hasDaysOfWeek"
            data-testid="days-of-week-section"
            class="pl-6 grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            <UCheckbox
              v-for="dayOpt in DAY_OPTIONS"
              :key="dayOpt.value"
              :model-value="modelValue.daysOfWeek.includes(dayOpt.value)"
              :label="dayOpt.label"
              @update:model-value="toggleDay(dayOpt.value)"
            />
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
