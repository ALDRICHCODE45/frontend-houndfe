<script setup lang="ts">
import { computed } from 'vue'
import { todayHoursLine } from '../utils/branch-hours'
import type { PublicCatalogBranchDetailDto } from '../interfaces/public-catalog-branch.types'
import '../styles/catalog-extras.css'

/**
 * Branch block of the product page (artboards 03, 04). Every line comes from the public branch
 * card: the address, today's hours, and pickup / delivery only from their flags.
 */
const props = defineProps<{ branch: PublicCatalogBranchDetailDto }>()

const hoursLine = computed(() => todayHoursLine(props.branch.hours))
const address = computed(() => props.branch.address?.formatted.trim() || null)
const hasContent = computed(
  () =>
    address.value !== null ||
    hoursLine.value !== null ||
    props.branch.pickupAvailable ||
    props.branch.deliveryAvailable,
)
</script>

<template>
  <section
    v-if="hasContent"
    data-testid="catalog-branch-block"
    class="catalog-branch-block"
    aria-labelledby="catalog-branch-block-title"
  >
    <h3 id="catalog-branch-block-title">
      {{ branch.name }}
      <span
        v-if="hoursLine"
        data-testid="catalog-branch-hours"
        class="catalog-branch-hours"
        :data-kind="hoursLine.kind"
        >{{ hoursLine.text }}</span
      >
    </h3>
    <p v-if="address" data-testid="catalog-branch-address" class="catalog-branch-row">
      <UIcon name="i-lucide-map-pin" aria-hidden="true" />{{ address }}
    </p>
    <ul v-if="branch.pickupAvailable || branch.deliveryAvailable" class="catalog-branch-options">
      <li v-if="branch.pickupAvailable" data-testid="catalog-branch-pickup">
        <UIcon name="i-lucide-store" aria-hidden="true" /><b>Recoger en sucursal</b>
      </li>
      <li v-if="branch.deliveryAvailable" data-testid="catalog-branch-delivery">
        <UIcon name="i-lucide-truck" aria-hidden="true" /><b>Envío a domicilio</b>
        <span>Según tu zona</span>
      </li>
    </ul>
  </section>
</template>
