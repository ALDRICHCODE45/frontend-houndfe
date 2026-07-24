<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useTenantSelection } from '@/features/auth/tenant-selection/composables/useTenantSelection'
import TenantSelectionList from '@/features/auth/tenant-selection/components/TenantSelectionList.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'

const route = useRoute()
const authStore = useAuthStore()
const { tenants, isSubmitting, error, submit, cancel } = useTenantSelection()

const isExpiredFlow = computed(() => route.query.expired === 'tenant')
const userName = computed(() => authStore.user?.name ?? 'Equipo HoundFe')
const userEmail = computed(() => authStore.user?.email ?? '')
// Role pill text: explicit Super Admin badge, otherwise a neutral "Equipo"
// label so we never silently render an empty chip on non-super-admin flows.
const roleLabel = computed(() => authStore.isSuperAdmin ? 'Super Admin' : 'Equipo')

// Two-stage selection: TenantSelectionList exposes the currently selected
// tenant id via defineExpose. The list fires `select` (highlight) and
// `confirm` (real submit); the parent's job is to wire the "Continuar"
// CTA into `confirm` and gate it on whether something is highlighted.
const listRef = ref<InstanceType<typeof TenantSelectionList> | null>(null)
// Track the selected id locally so the CTA stays reactive without depending
// on the child's exposed ref shape. The list's `select` event feeds this.
const localSelectedId = ref<string | null>(null)
const canContinue = computed(() => !!localSelectedId.value && !isSubmitting.value)

function handleContinue() {
  if (!canContinue.value) return
  listRef.value?.confirm()
}

function handleSelect(tenantId: string) {
  // Mirror the list's internal selection so the CTA can enable/disable
  // synchronously without reaching into the child's internals.
  localSelectedId.value = tenantId
}
</script>

<template>
  <div class="min-h-screen bg-default flex items-center justify-center px-4 py-10 sm:py-16">
    <div class="w-full max-w-2xl space-y-7">
      <!-- Header: logo + role badge + welcome + title + subtitle -->
      <div class="flex flex-col items-center text-center space-y-3">
        <div class="rounded-2xl bg-default border border-default p-2.5 shadow-sm">
          <img src="/hounfeLogos/primary.png" alt="HoundFe" class="size-10 object-contain" />
        </div>

        <span
          class="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
        >
          <UIcon name="i-lucide-shield-check" class="size-3.5" />
          {{ roleLabel }}
        </span>

        <div class="space-y-1.5">
          <p class="text-sm text-muted">Bienvenido, {{ userName }}</p>
          <h1 class="text-2xl sm:text-3xl font-semibold text-highlighted tracking-tight">
            Selecciona tu sucursal
          </h1>
          <p class="text-sm text-toned max-w-md mx-auto leading-relaxed">
            Elige la sucursal con la que quieres trabajar en esta sesión. Puedes cambiarla más tarde.
          </p>
        </div>
      </div>

      <!-- Main card: list + footer actions -->
      <div class="rounded-2xl border border-default dark:border-white/10 bg-elevated/60 dark:bg-white/[0.04] backdrop-blur-sm shadow-sm overflow-hidden">
        <div class="px-5 py-5 sm:px-6 sm:py-6 space-y-5">
          <UAlert
            v-if="isExpiredFlow"
            color="warning"
            variant="soft"
            icon="i-lucide-clock-alert"
            title="Tu sesión temporal expiró. Iniciá sesión nuevamente para continuar."
          />

          <UAlert
            v-if="error"
            color="error"
            variant="soft"
            icon="i-lucide-triangle-alert"
            :title="error"
          />

          <TenantSelectionList
            ref="listRef"
            :tenants="tenants"
            :is-submitting="isSubmitting"
            @select="handleSelect"
            @confirm="submit"
          />
        </div>

        <!-- Footer of the card: Cerrar sesión (left) + Continuar (right).
             The divider + padding match the reference's grouped actions. -->
        <div class="border-t border-default px-5 py-4 sm:px-6 flex items-center justify-between gap-3 bg-default/40">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-log-out"
            :disabled="isSubmitting"
            @click="cancel"
          >
            Cerrar sesión
          </UButton>

          <UButton
            color="primary"
            variant="solid"
            trailing-icon="i-lucide-arrow-right"
            :disabled="!canContinue"
            :loading="isSubmitting"
            data-testid="tenant-continue"
            @click="handleContinue"
          >
            Continuar
          </UButton>
        </div>
      </div>

      <!-- Page footer: who is signed in -->
      <p v-if="userEmail" class="text-center text-xs text-muted">
        Sesión iniciada como
        <span class="font-medium text-toned">{{ userEmail }}</span>
      </p>
    </div>
  </div>
</template>
