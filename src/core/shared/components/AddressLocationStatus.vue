<script setup lang="ts">
/**
 * One-line status telling whether an address has a saved map location.
 * Used on address rows and cards so users can spot addresses without a pin.
 */
import { computed } from 'vue'
import { hasSavedLocation, type AddressPinSource } from '@/core/shared/components/AddressMapPicker.vue'

const props = defineProps<{ address: AddressPinSource }>()

const located = computed(() => hasSavedLocation(props.address))
</script>

<template>
  <span
    data-testid="address-location-status"
    class="inline-flex shrink-0 items-center gap-1 text-xs"
    :class="located ? 'text-muted' : 'text-(--hf-warning)'"
  >
    <UIcon :name="located ? 'i-lucide-map-pin' : 'i-lucide-map-pin-off'" class="size-3.5" aria-hidden="true" />{{
      located ? 'Con ubicación' : 'Sin ubicación'
    }}
  </span>
</template>
