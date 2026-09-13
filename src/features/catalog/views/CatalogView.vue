<script setup lang="ts">
import CatalogHeader from '../components/CatalogHeader.vue'
import CatalogCategoryBar from '../components/CatalogCategoryBar.vue'
import CatalogProductGrid from '../components/CatalogProductGrid.vue'
import CatalogFooter from '../components/CatalogFooter.vue'
import { useCatalogBranches } from '../composables/useCatalogBranches'

const { branches, state, retry } = useCatalogBranches()
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <CatalogHeader :branches="branches" :state="state" @retry="retry" />
    <CatalogCategoryBar />

    <main class="flex-1">
      <CatalogProductGrid />
    </main>

    <CatalogFooter />
  </div>
</template>
