<script setup lang="ts">
/**
 * «Abrir caja» in ONE place (direction A): 1. the register as radio cards,
 * 2. the fund (received FLOAT or a new one) in pesos, 3. the explicit
 * confirmation that names the amount, then «Abrir caja con $X».
 *
 * Presentational: the view owns the registers read, the custody read and the
 * open command. The register list has one state at a time — loading, failed
 * (one message with Reintentar), empty or the cards — and register management
 * (create / activate) lives in a separate «Administrar cajas» disclosure that
 * never offers opening, so a register is chosen in exactly one control.
 */
import { computed } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import { HfRadioCards, type HfRadioCardItem } from '@/core/shared/components/selection'
import CashOpenSessionForm from './CashOpenSessionForm.vue'
import CashRegistersPanel from './CashRegistersPanel.vue'
import type { CashEligibleFloatItem, CashRegister } from '../interfaces/cash.types'

const props = withDefaults(
  defineProps<{
    registers?: CashRegister[]
    selectedRegisterId?: string | null
    loading?: boolean
    error?: boolean
    canReadRegisters?: boolean
    canCreate?: boolean
    canUpdate?: boolean
    canOpen?: boolean
    creating?: boolean
    updating?: boolean
    eligibleFloat?: CashEligibleFloatItem[]
    custodyVisible?: boolean
    submitting?: boolean
    errorMessage?: string | null
    registersErrorMessage?: string | null
  }>(),
  {
    registers: () => [],
    selectedRegisterId: null,
    loading: false,
    error: false,
    canReadRegisters: false,
    canCreate: false,
    canUpdate: false,
    canOpen: false,
    creating: false,
    updating: false,
    eligibleFloat: () => [],
    custodyVisible: false,
    submitting: false,
    errorMessage: null,
    registersErrorMessage: null,
  },
)

const floatId = defineModel<string | null>('floatId', { default: null })

const emit = defineEmits<{
  select: [registerId: string]
  create: [name: string]
  update: [id: string, payload: { name?: string; isActive?: boolean }]
  refresh: []
  submit: [payload: { openingCents: number; openingHandoverId?: string }]
}>()

const registerItems = computed<HfRadioCardItem[]>(() =>
  props.registers.map((register) => ({
    value: register.id,
    label: register.name,
    description: register.isActive ? 'Disponible para abrir' : 'Inactiva: no se puede abrir',
    disabled: !register.isActive || !props.canOpen,
  })),
)

const selectedName = computed(
  () => props.registers.find((item) => item.id === props.selectedRegisterId)?.name ?? null,
)
const canManage = computed(() => props.canCreate || props.canUpdate)
const isEmpty = computed(() => !props.loading && !props.error && props.registers.length === 0)

function choose(registerId: string) {
  if (registerId !== props.selectedRegisterId) emit('select', registerId)
}
</script>

<template>
  <div class="cash-opening" data-testid="cash-opening-panel">
    <div v-if="!canOpen" class="cash-callout" data-testid="cash-opening-forbidden">
      <UIcon name="i-lucide-lock" class="cash-callout-icon" aria-hidden="true" />
      <p>
        <strong>No tienes permiso para abrir caja</strong><br />
        <span class="cash-meta-wrap"
          >Pide a un encargado el permiso «Abrir caja». Lo demás de la caja sigue disponible.</span
        >
      </p>
    </div>

    <template v-else-if="canReadRegisters">
      <div
        v-if="loading"
        class="flex flex-col gap-3"
        aria-busy="true"
        data-testid="cash-opening-loading"
      >
        <span class="sr-only">Cargando cajas…</span>
        <div v-for="n in 2" :key="n" class="hf-skeleton h-16 w-full animate-pulse rounded-xl" aria-hidden="true" />
      </div>

      <EmptyState
        v-else-if="error"
        kind="error"
        title="No se pudieron cargar las cajas"
        :description="registersErrorMessage ?? 'Revisa la conexión e inténtalo de nuevo.'"
        action-label="Reintentar"
        data-testid="cash-opening-error"
        @action="emit('refresh')"
      />

      <EmptyState
        v-else-if="isEmpty && !canCreate"
        title="Aún no hay cajas"
        description="Pide a un encargado que cree la primera caja."
        data-testid="cash-opening-no-registers"
      />

      <fieldset v-else-if="!isEmpty" class="cash-fieldset">
        <legend id="cash-opening-register-legend" class="cash-legend">1. Caja</legend>
        <HfRadioCards
          :model-value="selectedRegisterId"
          :items="registerItems"
          labelledby="cash-opening-register-legend"
          selected-label=""
          data-testid="cash-opening-registers"
          @update:model-value="choose"
        />
        <p class="cash-notice">
          <UIcon name="i-lucide-info" class="size-4 shrink-0" aria-hidden="true" />
          Las cajas inactivas no se pueden abrir. El servidor confirma si la caja está libre.
        </p>
      </fieldset>
    </template>

    <CashOpenSessionForm
      v-if="canOpen"
      :key="`open:${selectedRegisterId ?? 'none'}`"
      v-model:float-id="floatId"
      :register-id="selectedRegisterId"
      :register-name="selectedName"
      :eligible-float="eligibleFloat"
      :custody-visible="custodyVisible"
      :can-open="canOpen"
      :submitting="submitting"
      :error-message="errorMessage"
      @submit="emit('submit', $event)"
    />

    <!-- Register management: create and (de)activate; never a second way to open. -->
    <details
      v-if="canReadRegisters && canManage && !loading && !error"
      class="cash-manage"
      :open="isEmpty"
      data-testid="cash-opening-manage"
    >
      <summary class="cash-manage-summary">Administrar cajas</summary>
      <CashRegistersPanel
        :registers="registers"
        :selected-register-id="selectedRegisterId"
        :can-create="canCreate"
        :can-update="canUpdate"
        :can-open="false"
        :creating="creating"
        :updating="updating"
        @create="emit('create', $event)"
        @update="(id, payload) => emit('update', id, payload)"
        @refresh="emit('refresh')"
      />
    </details>
  </div>
</template>
