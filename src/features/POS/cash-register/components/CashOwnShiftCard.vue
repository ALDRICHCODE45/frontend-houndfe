<script setup lang="ts">
/**
 * «Tu turno» in the side column: the viewer's latest own session whose drawer
 * is not released (picked by the view from the existing session list, no new
 * API). Clicking it brings that shift back into focus; without one it offers
 * opening a turn (only with the grant to open).
 */
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import type { CashSession } from '../interfaces/cash.types'
import { CASH_SESSION_STATUS_LABELS, cashSessionStatusTone } from '../utils/cash-status'

withDefaults(
  defineProps<{
    session?: CashSession | null
    registerName?: string | null
    loading?: boolean
    /** The own shift is the one in focus. */
    selected?: boolean
    /** Nothing is in focus and the opening is showing. */
    openingSelected?: boolean
    canOpen?: boolean
  }>(),
  {
    session: null,
    registerName: null,
    loading: false,
    selected: false,
    openingSelected: false,
    canOpen: false,
  },
)

const emit = defineEmits<{ select: [sessionId: string]; requestOpening: [] }>()
</script>

<template>
  <section class="cash-own-shift" aria-labelledby="cash-own-shift-title" data-testid="cash-own-shift">
    <h2 id="cash-own-shift-title" class="cash-side-title">Tu turno</h2>

    <div v-if="loading" class="hf-skeleton h-16 w-full animate-pulse rounded-xl" aria-hidden="true" />

    <button
      v-else-if="session"
      type="button"
      class="cash-sess"
      :aria-current="selected ? 'true' : undefined"
      data-testid="cash-own-shift-select"
      @click="emit('select', session.id)"
    >
      <span class="cash-sess-row">
        <span class="cash-strong">{{ registerName ?? 'Caja' }}</span>
        <StatusBadge
          :label="CASH_SESSION_STATUS_LABELS[session.status]"
          :tone="cashSessionStatusTone(session.status)"
        />
      </span>
      <span v-if="session.openedAt" class="cash-meta-wrap">
        Desde {{ formatShortDateTime(session.openedAt) }}
      </span>
    </button>

    <button
      v-else-if="canOpen"
      type="button"
      class="cash-sess"
      :aria-current="openingSelected ? 'true' : undefined"
      data-testid="cash-own-shift-open"
      @click="emit('requestOpening')"
    >
      <span class="cash-strong">Sin turno abierto</span>
      <span class="cash-meta-wrap">Abre uno para empezar a vender</span>
    </button>

    <p v-else class="cash-meta-wrap" data-testid="cash-own-shift-none">No tienes un turno abierto.</p>

    <p class="cash-meta-wrap cash-side-note">Se elige solo: tu última sesión con el cajón sin liberar.</p>
  </section>
</template>
