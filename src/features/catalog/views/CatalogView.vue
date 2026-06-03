<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useCatalogStore } from '../composables/useCatalogStore'
import { useCatalogCart } from '../composables/useCatalogCart'
import CatalogHeader from '../components/CatalogHeader.vue'
import CatalogCategoryBar from '../components/CatalogCategoryBar.vue'
import CatalogProductGrid from '../components/CatalogProductGrid.vue'
import CatalogProductModal from '../components/CatalogProductModal.vue'
import CatalogCartDrawer from '../components/CatalogCartDrawer.vue'
import CatalogFooter from '../components/CatalogFooter.vue'

const route = useRoute()
const catalog = useCatalogStore()
const cart = useCatalogCart()

onMounted(async () => {
  const branchSlug = route.params.branchSlug as string | undefined
  await catalog.init(branchSlug)

  if (catalog.selectedBranch) {
    cart.setBranchName(catalog.selectedBranch.name)
  }
})
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <CatalogHeader />
    <CatalogCategoryBar />

    <main class="flex-1">
      <CatalogProductGrid />
    </main>

    <CatalogFooter />

    <!-- Overlays -->
    <CatalogProductModal />
    <CatalogCartDrawer />
  </div>
</template>
