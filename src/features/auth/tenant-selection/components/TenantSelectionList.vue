<script setup lang="ts">
import { ref, watch } from 'vue'
import type { TenantSummary } from '@/features/auth/interfaces/auth.types'

const props = defineProps<{
  tenants: TenantSummary[]
  isSubmitting?: boolean
}>()

const emit = defineEmits<{
  select: [tenantId: string]
}>()

const selectingTenantId = ref<string | null>(null)

watch(
  () => props.isSubmitting,
  (isSubmitting) => {
    if (!isSubmitting) {
      selectingTenantId.value = null
    }
  },
)

function getTenantInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || 'S'
}

function selectTenant(tenantId: string) {
  if (props.isSubmitting) return
  selectingTenantId.value = tenantId
  emit('select', tenantId)
}
</script>

<template>
  <div class="grid gap-3">
    <UCard
      v-for="tenant in tenants"
      :key="tenant.id"
      role="button"
      tabindex="0"
      class="border border-default dark:border-white/10 bg-elevated/40 dark:bg-white/[0.06] transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/15 hover:bg-elevated/80 dark:hover:bg-white/[0.1]"
      :class="{
        'pointer-events-none opacity-80': !!props.isSubmitting && selectingTenantId !== tenant.id,
        'border-primary/70 shadow-lg shadow-primary/20 bg-elevated/80 dark:bg-white/[0.1]': selectingTenantId === tenant.id && props.isSubmitting,
      }"
      @click="selectTenant(tenant.id)"
      @keydown.enter.prevent="selectTenant(tenant.id)"
      @keydown.space.prevent="selectTenant(tenant.id)"
    >
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <UAvatar :alt="tenant.name" :text="getTenantInitial(tenant.name)" />

          <div class="min-w-0">
            <p class="text-sm font-semibold text-highlighted truncate">{{ tenant.name }}</p>
            <p class="text-xs text-muted truncate">{{ tenant.slug }}</p>
          </div>
        </div>

        <UIcon
          v-if="props.isSubmitting && selectingTenantId === tenant.id"
          name="i-lucide-loader-circle"
          class="size-4 text-primary animate-spin shrink-0"
        />
        <UIcon v-else name="i-lucide-chevron-right" class="size-4 text-dimmed shrink-0" />
      </div>
    </UCard>
  </div>
</template>
