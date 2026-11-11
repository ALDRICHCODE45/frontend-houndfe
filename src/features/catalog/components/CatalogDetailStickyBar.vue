<script setup lang="ts">
import CatalogWhatsappLink from './CatalogWhatsappLink.vue'
import '../styles/catalog-extras.css'

/**
 * Mobile bottom bar of the product page (artboard 04): the selected presentation's price,
 * «Cambiar» to reach the presentations, and the WhatsApp action. Parents render it only
 * when a number exists, so there is no bar at all without WhatsApp.
 */
defineProps<{
  price: string | null
  /** The selected presentation's name, when there are presentations. */
  line: string | null
  /** Offers «Cambiar» only when there is something to change. */
  canChange: boolean
  whatsappNumber: string
  message: string
  asking: boolean
}>()
const emit = defineEmits<{ change: [] }>()
</script>

<template>
  <div
    data-testid="catalog-detail-sticky-bar"
    class="catalog-sticky-bar"
    role="region"
    aria-label="Resumen de la presentación elegida"
  >
    <div class="catalog-sticky-summary">
      <b v-if="price" data-testid="catalog-sticky-price">{{ price }} <small>MXN</small></b>
      <b v-else class="catalog-sticky-consult">Consultar precio</b>
      <span v-if="line || canChange">
        <template v-if="line">{{ line }}</template>
        <template v-if="line && canChange"> · </template>
        <button v-if="canChange" data-testid="catalog-sticky-change" type="button" @click="emit('change')">
          Cambiar
        </button>
      </span>
    </div>
    <CatalogWhatsappLink
      variant="bar"
      :number="whatsappNumber"
      :message="message"
      :label="asking ? 'Preguntar por WhatsApp' : 'Pedir por WhatsApp'"
      :secondary="asking"
    />
  </div>
</template>
