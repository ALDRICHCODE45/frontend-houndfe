<script setup lang="ts">
import { computed } from 'vue'
import CatalogWhatsappIcon from './CatalogWhatsappIcon.vue'
import { buildWhatsappUrl } from '../utils/whatsapp'
import '../styles/catalog-extras.css'

/**
 * A link to the business WhatsApp with a prefilled message. It renders nothing without a usable
 * number, so every surface that places it stays exactly as before on a backend without v0.
 * `icon` is the 44 px card control; `cta` and `bar` are labelled buttons (`secondary` when asking).
 */
const props = withDefaults(
  defineProps<{
    number: string | null | undefined
    message: string
    label: string
    variant?: 'icon' | 'cta' | 'bar' | 'text'
    secondary?: boolean
    /** Accessible name for the icon variant; defaults to the label. */
    ariaLabel?: string
  }>(),
  { variant: 'cta', secondary: false, ariaLabel: undefined },
)

const href = computed(() => buildWhatsappUrl(props.number, props.message))
</script>

<template>
  <a
    v-if="href"
    data-testid="catalog-whatsapp-link"
    class="catalog-wa"
    :class="[`catalog-wa--${variant}`, { 'catalog-wa--secondary': secondary }]"
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    :aria-label="variant === 'icon' ? (ariaLabel ?? label) : undefined"
  >
    <CatalogWhatsappIcon class="catalog-wa-icon" />
    <span v-if="variant !== 'icon'">{{ label }}</span>
  </a>
</template>
