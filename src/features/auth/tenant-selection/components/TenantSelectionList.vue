<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { TenantSummary } from '@/features/auth/interfaces/auth.types'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'

const props = withDefaults(
  defineProps<{
    tenants: TenantSummary[]
    isSubmitting?: boolean
  }>(),
  {
    isSubmitting: false,
  },
)

const emit = defineEmits<{
  select: [tenantId: string]
  confirm: [tenantId: string]
}>()

// Two-stage selection model: tapping a card selects it (does NOT submit),
// the parent confirms via the "Continuar" CTA. selectedTenantId is the
// current intent; selectingTenantId is the in-flight submit target so
// the spinner renders only on the row being submitted, not on a row
// that the user merely highlighted.
const selectedTenantId = ref<string | null>(null)
const selectingTenantId = ref<string | null>(null)

watch(
  () => props.isSubmitting,
  (isSubmitting) => {
    if (!isSubmitting) {
      selectingTenantId.value = null
    }
  },
)

// Emit `select` so the parent can enable the "Continuar" CTA. We don't
// submit yet — the user still needs to confirm.
function handleCardTap(tenant: TenantSummary) {
  if (props.isSubmitting) return
  selectedTenantId.value = tenant.id
  emit('select', tenant.id)
}

// Convenience submit hook the parent can call when "Continuar" is clicked.
function handleConfirm() {
  if (!selectedTenantId.value || props.isSubmitting) return
  selectingTenantId.value = selectedTenantId.value
  emit('confirm', selectedTenantId.value)
}

defineExpose({
  // Return the current value (a plain string|null) — not the Ref itself —
  // so the parent can read it synchronously without unwrapping. The parent
  // re-reads inside a computed, so reactivity is preserved: any change to
  // the underlying ref re-evaluates the parent's `canContinue`.
  getSelectedTenantId: () => selectedTenantId.value,
  confirm: handleConfirm,
})

// ── Search ────────────────────────────────────────────────────────────────────
// Client-side filter across name + slug. Trims and lowercases for forgiving
// matching. Empty search returns the original list.
const search = ref('')

const filteredTenants = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.tenants
  return props.tenants.filter((tenant) => {
    return (
      tenant.name.toLowerCase().includes(q)
      || tenant.slug.toLowerCase().includes(q)
    )
  })
})

// ── Visual helpers ───────────────────────────────────────────────────────────

function getTenantInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || 'S'
}

function statusTone(status: string | null | undefined): 'success' | 'neutral' {
  return status === 'open' ? 'success' : 'neutral'
}
function statusLabel(status: string | null | undefined): string {
  if (status === 'open') return 'Abierta'
  if (status === 'closed') return 'Cerrada'
  return status ?? ''
}
</script>

<template>
  <div class="space-y-3">
    <EmptyState
      v-if="tenants.length === 0"
      title="No tienes sucursales disponibles"
      description="Pide a un administrador que te asigne una."
    />

    <template v-else>
      <UInput
        v-model="search"
        type="text"
        icon="i-lucide-search"
        placeholder="Buscar sucursal…"
        aria-label="Buscar sucursal"
        size="lg"
        class="w-full"
      />

      <EmptyState
        v-if="filteredTenants.length === 0"
        kind="no-match"
        :title="`Ningún resultado para «${search.trim()}»`"
        action-label="Limpiar búsqueda"
        @action="search = ''"
      />

      <div v-else class="grid gap-2">
        <button
          v-for="tenant in filteredTenants"
          :key="tenant.id"
          type="button"
          data-testid="tenant-row"
          class="hf-tenant-row"
          :aria-pressed="selectedTenantId === tenant.id"
          :data-selected="selectedTenantId === tenant.id ? 'true' : undefined"
          :data-busy="props.isSubmitting && selectingTenantId !== tenant.id ? 'true' : undefined"
          @click="handleCardTap(tenant)"
        >
          <span class="hf-tenant-initial" aria-hidden="true">{{ getTenantInitial(tenant.name) }}</span>

          <span class="min-w-0 flex-1">
            <span class="flex min-w-0 items-center gap-2">
              <span class="hf-tenant-name">{{ tenant.name }}</span>
              <StatusBadge
                v-if="tenant.status"
                :label="statusLabel(tenant.status)"
                :tone="statusTone(tenant.status)"
              />
            </span>
            <span v-if="tenant.address" class="hf-tenant-meta">
              <UIcon name="i-lucide-map-pin" class="size-3 shrink-0" />
              <span class="truncate">{{ tenant.address }}</span>
            </span>
            <span v-if="tenant.onShiftCount != null" class="hf-tenant-meta">
              <UIcon name="i-lucide-users" class="size-3 shrink-0" />
              {{ tenant.onShiftCount }} en turno
            </span>
          </span>

          <UIcon
            v-if="props.isSubmitting && selectingTenantId === tenant.id"
            name="i-lucide-loader-circle"
            class="hf-tenant-trailing animate-spin"
          />
          <UIcon
            v-else-if="selectedTenantId === tenant.id"
            name="i-lucide-check"
            class="hf-tenant-trailing"
          />
        </button>
      </div>
    </template>
  </div>
</template>
