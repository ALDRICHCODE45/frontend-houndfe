<script setup lang="ts">
/** «Mascotas» from the customer row: the pets list for roles that can read customers (handoff 27 §1). */
import type { Customer } from '../interfaces/customer.types'
import CustomerPetsSection from './CustomerPetsSection.vue'

defineProps<{ customer: Customer | null }>()
const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="customer ? `Mascotas de ${customer.fullName}` : 'Mascotas'"
    description="Mascotas registradas del cliente."
    side="right"
    inset
    :ui="{ content: 'hf-theme hf-ui hf-form-overlay clients-form-portal' }"
  >
    <template #body>
      <CustomerPetsSection v-if="customer" :customer-id="customer.id" />
    </template>
  </USlideover>
</template>
