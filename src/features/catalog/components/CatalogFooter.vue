<script setup lang="ts">
import { computed, inject } from 'vue'
import { routeLocationKey } from 'vue-router'
import CatalogWhatsappLink from './CatalogWhatsappLink.vue'
import { useCachedCatalogBranch } from '../composables/useCatalogBranches'
import { useCatalogBranchDetail } from '../composables/useCatalogBranchDetail'
import { todayHoursLine } from '../utils/branch-hours'
import '../styles/catalog-extras.css'

/**
 * Footer with the selected branch (artboards 01, 02). The address, today's hours and the WhatsApp
 * line come from the public branch card and the branches list; each shows only when its data is
 * present, so a backend without v0 renders the plain footer.
 */
const props = withDefaults(defineProps<{ branchName?: string | null }>(), { branchName: null })

// The footer reads the branch from the route itself, so the listing and the product page share it.
const route = inject(routeLocationKey, null)
const branchSlug = computed(() => {
  const slug = route?.params.branchSlug
  return props.branchName && typeof slug === 'string' && slug.length > 0 ? slug : null
})
const { branch } = useCatalogBranchDetail(branchSlug)
const { branch: listedBranch } = useCachedCatalogBranch(branchSlug)

const address = computed(() => branch.value?.address?.formatted.trim() || null)
const hoursLine = computed(() => todayHoursLine(branch.value?.hours ?? null))
const whatsappNumber = computed(
  () => listedBranch.value?.whatsappNumber || branch.value?.whatsappNumber || null,
)
const whatsappMessage = computed(() => `Hola, tengo una duda sobre el catálogo de ${props.branchName}`)
</script>

<template>
  <footer class="catalog-footer">
    <div class="catalog-container catalog-footer-inner">
      <div class="catalog-footer-brand">
        <img
          class="catalog-logo"
          src="/hounfeLogos/primary.png"
          alt="HoundFe"
          width="96"
          height="96"
        />
        <p v-if="branchName">Catálogo de {{ branchName }}. Precios en pesos mexicanos (MXN).</p>
        <p v-else>Para quienes son parte de tu vida.</p>
      </div>
      <div v-if="branchName" class="catalog-footer-branch catalog-footer-contact">
        <b data-testid="catalog-footer-branch">{{ branchName }}</b>
        <span v-if="address" data-testid="catalog-footer-address">
          <UIcon name="i-lucide-map-pin" data-icon aria-hidden="true" />{{ address }}
        </span>
        <span v-if="hoursLine" data-testid="catalog-footer-hours">
          <UIcon name="i-lucide-clock" data-icon aria-hidden="true" />{{ hoursLine.text }}
        </span>
        <CatalogWhatsappLink
          v-if="whatsappNumber"
          variant="text"
          :number="whatsappNumber"
          :message="whatsappMessage"
          label="Pedidos y dudas por WhatsApp"
        />
      </div>
      <p v-else>Precios y existencias por sucursal.</p>
    </div>
  </footer>
</template>
