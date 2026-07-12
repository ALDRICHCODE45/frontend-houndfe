<script setup lang="ts">
import { ref, watch } from 'vue'
import type {
  PromotionTargetItemFormEntry,
  PromotionTargetType,
} from '../../interfaces/promotion.types'
import FlatChecklistPanel from './FlatChecklistPanel.vue'

// ── Props & emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  /** Modal open state (v-model). */
  open: boolean
  /** Which target type the modal is operating in (REQ-1). */
  type: PromotionTargetType
  /** Already-confirmed items from the parent form. Used to seed staged. */
  selectedItems: PromotionTargetItemFormEntry[]
  /** Reserved for Slice 2 — VARIANTS routing honors allowVariants. */
  allowVariants?: boolean
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  /** Emitted only on explicit confirm (REQ-2 transactional). */
  confirm: [items: PromotionTargetItemFormEntry[]]
}>()

// ── Staged state (modal-local, seeded on open) ──────────────────────────────
// REQ-2: selections live in modal-local state. Cancel/Esc/backdrop MUST NOT
// emit `confirm`. Reopen re-derives staged from the latest `selectedItems`
// (the parent owns the source of truth).

const staged = ref<PromotionTargetItemFormEntry[]>([])

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      // Re-seed on every open so the modal reflects the parent's confirmed
      // state, not the user's last (possibly discarded) selection.
      staged.value = props.selectedItems.map((entry) => ({ ...entry }))
    }
  },
  { immediate: true },
)

// ── Handlers ─────────────────────────────────────────────────────────────────

function onUpdateStaged(next: PromotionTargetItemFormEntry[]) {
  staged.value = next
}

function onCancel() {
  // Discard staged, just close. No `confirm` emit.
  emit('update:open', false)
}

function onConfirm() {
  emit('confirm', staged.value)
  emit('update:open', false)
}

// Expose for tests/automation if ever needed.
defineExpose({ onConfirm, onCancel, staged })
</script>

<template>
  <UModal
    :open="open"
    :title="`Seleccionar ${type === 'CATEGORIES' ? 'categorías' : type === 'BRANDS' ? 'marcas' : type === 'PRODUCTS' ? 'productos' : 'variantes'}`"
    description="Modal de selección de targets para promociones"
    :ui="{ width: 'max-w-2xl' }"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <!-- Flat panel: CATEGORIES | BRANDS | PRODUCTS (REQ-1, REQ-3, REQ-5) -->
        <FlatChecklistPanel
          v-if="type === 'CATEGORIES' || type === 'BRANDS' || type === 'PRODUCTS'"
          :data-source="type"
          :staged="staged"
          @update:staged="onUpdateStaged"
        />
        <!-- VARIANTS is NOT routed yet (Slice 2 introduces VariantsPanel).
             Keeping the modal open for VARIANTS without a body is the
             build-safety path (see tasks 1.8). The parent still owns the
             VARIANTS path inline (ProductVariantSelector). -->
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          data-testid="cancel-modal"
          @click="onCancel"
        >
          Cancelar
        </UButton>
        <UButton
          color="primary"
          data-testid="confirm-add-selected"
          @click="onConfirm"
        >
          Agregar seleccionados
        </UButton>
      </div>
    </template>
  </UModal>
</template>
