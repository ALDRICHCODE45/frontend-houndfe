<script setup lang="ts">
/**
 * Footer with the selected branch (artboards 01, 02). Address, hours and contact arrive
 * with the public branch endpoint (T4); until then nothing is invented here.
 */
withDefaults(defineProps<{ branchName?: string | null }>(), { branchName: null })
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
      <div v-if="branchName" class="catalog-footer-branch">
        <b data-testid="catalog-footer-branch">{{ branchName }}</b>
      </div>
      <p v-else>Precios y existencias por sucursal.</p>
    </div>
  </footer>
</template>
