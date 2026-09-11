<script setup lang="ts">
import CatalogHeader from '../components/CatalogHeader.vue'
import CatalogCategoryBar from '../components/CatalogCategoryBar.vue'
import CatalogProductGrid from '../components/CatalogProductGrid.vue'
import CatalogFooter from '../components/CatalogFooter.vue'
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <CatalogHeader />
    <CatalogCategoryBar />

    <main class="flex-1">
      <CatalogProductGrid />
    </main>

    <CatalogFooter />
  </div>
</template>
