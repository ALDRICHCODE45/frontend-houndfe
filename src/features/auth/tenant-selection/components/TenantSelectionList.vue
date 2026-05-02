<script setup lang="ts">
import type { TenantSummary } from '@/features/auth/interfaces/auth.types'

defineProps<{
  tenants: TenantSummary[]
  isSubmitting?: boolean
}>()

const emit = defineEmits<{
  select: [tenantId: string]
}>()

function selectTenant(tenantId: string) {
  emit('select', tenantId)
}
</script>

<template>
  <div class="grid gap-3">
    <UCard v-for="tenant in tenants" :key="tenant.id" class="border border-neutral-200 dark:border-neutral-800">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{{ tenant.name }}</p>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ tenant.slug }}</p>
        </div>

        <UButton
          color="primary"
          :loading="isSubmitting"
          :disabled="isSubmitting"
          @click="selectTenant(tenant.id)"
        >
          Seleccionar
        </UButton>
      </div>
    </UCard>
  </div>
</template>
