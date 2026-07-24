<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { TenantSummary } from '@/features/auth/interfaces/auth.types'

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

// Deterministic avatar color from the tenant id — same id always paints the
// same color, no flicker between renders. Uses the amber/rose/zinc palette
// already declared in DESIGN.md so the avatars feel native to the system.
// Note: the upcoming palette refactor (separate change) will re-tune this
// set without touching the function contract.
const AVATAR_TONES = ['amber', 'rose', 'sky', 'emerald', 'violet', 'orange'] as const
type AvatarTone = (typeof AVATAR_TONES)[number]
function avatarTone(tenantId: string): AvatarTone {
  let hash = 0
  for (let i = 0; i < tenantId.length; i++) {
    hash = (hash * 31 + tenantId.charCodeAt(i)) >>> 0
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length] as AvatarTone
}

type StatusTone = 'success' | 'neutral'
function statusTone(status: string | null | undefined): StatusTone {
  return status === 'open' ? 'success' : 'neutral'
}
function statusLabel(status: string | null | undefined): string {
  if (status === 'open') return 'ABIERTA'
  if (status === 'closed') return 'CERRADA'
  return status ? status.toUpperCase() : ''
}
</script>

<template>
  <div class="space-y-3">
    <!-- Search input: filters the list by name or slug. Always visible even
         with a single tenant so the affordance is consistent across sessions. -->
    <div class="relative">
      <UIcon
        name="i-lucide-search"
        class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-dimmed pointer-events-none"
      />
      <input
        v-model="search"
        type="text"
        placeholder="Buscar sucursal…"
        aria-label="Buscar sucursal"
        class="w-full rounded-xl border border-default bg-default/60 pl-9 pr-3 py-2.5
               text-sm placeholder:text-dimmed text-highlighted
               focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40
               transition-colors"
      >
    </div>

    <!-- Empty search state: shown when the search yields no results. Keeps
         the "Cerrar sesión" + "Continuar" footer visible regardless. -->
    <div
      v-if="filteredTenants.length === 0"
      class="rounded-xl border border-dashed border-default px-4 py-8 text-center"
    >
      <p class="text-sm text-toned">No encontramos sucursales con ese término.</p>
    </div>

    <div v-else class="grid gap-2.5">
      <button
        v-for="tenant in filteredTenants"
        :key="tenant.id"
        type="button"
        role="button"
        tabindex="0"
        :aria-pressed="selectedTenantId === tenant.id"
        class="w-full text-left rounded-xl border bg-elevated/40 dark:bg-white/[0.04]
               px-3.5 py-3 transition-all duration-200 cursor-pointer
               hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md hover:shadow-primary/15
               focus:outline-none focus:ring-2 focus:ring-primary/40"
        :class="[
          selectedTenantId === tenant.id
            ? 'border-primary/70 shadow-md shadow-primary/20 bg-elevated/80 dark:bg-white/[0.08]'
            : 'border-default dark:border-white/10',
          props.isSubmitting && selectingTenantId !== tenant.id ? 'pointer-events-none opacity-70' : '',
        ]"
        @click="handleCardTap(tenant)"
        @keydown.enter.prevent="handleCardTap(tenant)"
        @keydown.space.prevent="handleCardTap(tenant)"
      >
        <div class="flex items-center gap-3">
          <!-- Avatar: colored block with the tenant initial. Tone is hashed
               from the tenant id so colors are stable across renders. -->
          <div
            class="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center
                   font-semibold text-sm text-white"
            :class="{
              'bg-amber-500': avatarTone(tenant.id) === 'amber',
              'bg-rose-500': avatarTone(tenant.id) === 'rose',
              'bg-sky-500': avatarTone(tenant.id) === 'sky',
              'bg-emerald-500': avatarTone(tenant.id) === 'emerald',
              'bg-violet-500': avatarTone(tenant.id) === 'violet',
              'bg-orange-500': avatarTone(tenant.id) === 'orange',
            }"
          >
            {{ getTenantInitial(tenant.name) }}
          </div>

          <!-- Tenant identity + meta -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 min-w-0">
              <p class="text-sm font-semibold text-highlighted truncate">
                {{ tenant.name }}
              </p>
              <span
                v-if="tenant.status"
                class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide"
                :class="statusTone(tenant.status) === 'success'
                  ? 'bg-success/15 text-success'
                  : 'bg-elevated/80 text-muted'"
              >
                <span
                  class="inline-block size-1.5 rounded-full"
                  :class="statusTone(tenant.status) === 'success' ? 'bg-success' : 'bg-muted'"
                />
                {{ statusLabel(tenant.status) }}
              </span>
            </div>

            <!-- Address (v-if: only renders when the backend sends it) -->
            <p
              v-if="tenant.address"
              class="mt-0.5 flex items-center gap-1 text-xs text-muted truncate"
            >
              <UIcon name="i-lucide-map-pin" class="size-3 shrink-0" />
              <span class="truncate">{{ tenant.address }}</span>
            </p>

            <!-- Staff on shift (v-if) -->
            <p
              v-if="tenant.onShiftCount != null"
              class="mt-0.5 flex items-center gap-1 text-xs text-muted"
            >
              <UIcon name="i-lucide-users" class="size-3 shrink-0" />
              <span>{{ tenant.onShiftCount }} en turno</span>
            </p>
          </div>

          <!-- Right-side affordance: spinner while submitting this row,
               otherwise the chevron — selected rows show a filled check. -->
          <UIcon
            v-if="props.isSubmitting && selectingTenantId === tenant.id"
            name="i-lucide-loader-circle"
            class="size-4 text-primary animate-spin shrink-0"
          />
          <UIcon
            v-else-if="selectedTenantId === tenant.id"
            name="i-lucide-arrow-right"
            class="size-4 text-primary shrink-0"
          />
          <UIcon
            v-else
            name="i-lucide-arrow-right"
            class="size-4 text-dimmed shrink-0"
          />
        </div>
      </button>
    </div>
  </div>
</template>
