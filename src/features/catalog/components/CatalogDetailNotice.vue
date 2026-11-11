<script setup lang="ts">
/**
 * One page-level state of the product page (missing product, failure, branch without catalog):
 * an icon, what happened, one line, and the ways out the parent puts in the default slot.
 * A failure is announced as an alert; an absence is a calm status.
 */
withDefaults(
  defineProps<{
    title: string
    description?: string
    icon?: string
    tone?: 'status' | 'alert'
  }>(),
  { description: undefined, icon: 'i-lucide-package-x', tone: 'status' },
)
</script>

<template>
  <section data-testid="catalog-detail-notice" class="catalog-pdp-notice" :role="tone">
    <span class="catalog-pdp-notice-icon" aria-hidden="true">
      <UIcon :name="icon" class="size-6" />
    </span>
    <h1 class="catalog-pdp-notice-title">{{ title }}</h1>
    <p v-if="description" class="catalog-pdp-notice-text">{{ description }}</p>
    <div v-if="$slots.default" class="catalog-pdp-notice-actions">
      <slot />
    </div>
  </section>
</template>
