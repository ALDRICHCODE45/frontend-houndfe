<script setup lang="ts">
withDefaults(defineProps<{ branchName?: string | null }>(), { branchName: null })

/** Keep this a local navigation action: no route/query or request state changes. */
function exploreCatalog(event: MouseEvent) {
  const target = document.getElementById('catalogo')
  if (!target) return
  event.preventDefault()
  target.focus({ preventScroll: true })
  target.scrollIntoView({ block: 'start' })
}
</script>

<template>
  <section class="catalog-hero" aria-labelledby="catalog-hero-title">
    <div class="catalog-hero-copy">
      <span class="catalog-hero-eyebrow"
        ><i aria-hidden="true" />{{ branchName ? `Tienda en línea · ${branchName}` : 'Tienda en línea' }}</span
      >
      <h1 id="catalog-hero-title">Todo para quienes te acompañan.</h1>
      <p>Consulta presentaciones, precios y disponibilidad de tu sucursal.</p>
      <a href="#catalogo" class="catalog-hero-link" @click="exploreCatalog">
        Explorar productos <UIcon name="i-lucide-arrow-right" aria-hidden="true" />
      </a>
    </div>
    <div class="catalog-hero-image">
      <img
        src="/images/catalog-companions.png"
        alt="Perro golden retriever y gato juntos en un estudio"
        width="1264"
        height="848"
        fetchpriority="high"
      />
      <span class="catalog-hero-caption" aria-hidden="true"
        >Grandes compañeros.<b>Pequeños cuidados, todos los días.</b></span
      >
    </div>
  </section>
</template>
