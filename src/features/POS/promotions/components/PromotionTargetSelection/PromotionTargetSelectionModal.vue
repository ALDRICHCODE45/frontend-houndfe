<script setup lang="ts">
import { ref, watch } from 'vue'
import type {
  PromotionTargetItemFormEntry,
  PromotionTargetType,
} from '../../interfaces/promotion.types'
import { chipLabel } from '../../utils/promotionChipLabel'
import FlatChecklistPanel from './FlatChecklistPanel.vue'
import VariantsPanel from './VariantsPanel.vue'
import { PROMOTION_TARGET_TYPE } from '../../constants/promotion.constants'

// ── Props & emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  /** Modal open state (v-model). */
  open: boolean
  /** Which target type the modal is operating in (REQ-1). */
  type: PromotionTargetType
  /** Already-confirmed items from the parent form. Used to seed staged. */
  selectedItems: PromotionTargetItemFormEntry[]
  /** Reserved — VARIANTS routing honors allowVariants. */
  allowVariants?: boolean
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  /** Emitted only on explicit confirm (REQ-2 transactional). */
  confirm: [items: PromotionTargetItemFormEntry[]]
}>()

// ── Toast (REQ-7) ─────────────────────────────────────────────────────────────
// useToast is provided by UApp via inject. We declare the shape locally so TS
// knows the call signature without depending on @nuxt/ui auto-imports during
// tests (UApp's runtime provider supplies the actual implementation).

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}
const toast = useToast()

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

/**
 * REQ-7 duplicate-label guard.
 *
 * Walks the staged array and skips any entry whose `chipLabel` collides with
 * an already-confirmed chip's label (the parent's `selectedItems`) OR with
 * another staged entry's label — provided the targetId differs. Same id is
 * always idempotent and never flagged.
 *
 * On any skip, fires a single warning toast with the canonical Spanish copy
 * (the UI copy table in the spec) and the modal then emits the deduped array.
 * Distinct labels pass through untouched.
 */
function dedupeStagedForConfirm(): PromotionTargetItemFormEntry[] {
  const seenLabelsById = new Map<string, Set<string>>()
  // Seed the seen map with the parent's already-confirmed chips.
  for (const existing of props.selectedItems) {
    const label = chipLabel(existing, props.type)
    if (!seenLabelsById.has(label)) seenLabelsById.set(label, new Set())
    seenLabelsById.get(label)!.add(existing.targetId)
  }

  let skipped = false
  const out: PromotionTargetItemFormEntry[] = []

  for (const entry of staged.value) {
    const label = chipLabel(entry, props.type)
    const idsForLabel = seenLabelsById.get(label)

    if (idsForLabel) {
      if (idsForLabel.has(entry.targetId)) {
        // Same label + same id → idempotent, keep it (no warning).
        out.push(entry)
        continue
      }
      // Same label, different id → skip + warn.
      idsForLabel.add(entry.targetId)
      skipped = true
      continue
    }

    // First time we see this label — keep and register the id.
    seenLabelsById.set(label, new Set([entry.targetId]))
    out.push(entry)
  }

  if (skipped) {
    toast.add({
      title: 'Ya existe un elemento con este nombre. ¿Deseas continuar?',
      color: 'warning',
    })
  }

  return out
}

function onConfirm() {
  emit('confirm', dedupeStagedForConfirm())
  emit('update:open', false)
}

// Expose for tests/automation if ever needed.
defineExpose({ onConfirm, onCancel, staged })
</script>

<template>
  <UModal
    :open="open"
    :title="`Seleccionar ${type === PROMOTION_TARGET_TYPE.CATEGORIES ? 'categorías' : type === PROMOTION_TARGET_TYPE.BRANDS ? 'marcas' : type === PROMOTION_TARGET_TYPE.PRODUCTS ? 'productos' : 'variantes'}`"
    description="Modal de selección de targets para promociones"
    :ui="{ width: 'max-w-2xl' }"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <!-- Flat panel: CATEGORIES | BRANDS | PRODUCTS (REQ-1, REQ-3, REQ-5) -->
        <FlatChecklistPanel
          v-if="type === PROMOTION_TARGET_TYPE.CATEGORIES || type === PROMOTION_TARGET_TYPE.BRANDS || type === PROMOTION_TARGET_TYPE.PRODUCTS"
          :data-source="type"
          :staged="staged"
          @update:staged="onUpdateStaged"
        />
        <!-- Variants accordion: VARIANTS (REQ-4) -->
        <VariantsPanel
          v-else-if="type === PROMOTION_TARGET_TYPE.VARIANTS"
          :staged="staged"
          @update:staged="onUpdateStaged"
        />
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
