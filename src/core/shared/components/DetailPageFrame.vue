<script setup lang="ts">
/**
 * The frame every detail page shares (design system «Detail page scroll»).
 *
 * The root cancels the dashboard body's padding (-m-4 sm:-m-6) and fills the panel, so the header
 * spans the full width at the very top. The header is pinned by the flex column, never by
 * `sticky`: inside the padded body a sticky header is offset by that padding into a blank strip.
 * The full-width area below is the only scroller, so the wheel works anywhere on the page; each
 * page centres its own content (mx-auto max-w-*) inside it. The footer holds the mobile action bar.
 */
defineProps<{
  /** data-testid of the scroll area. */
  scrollTestid?: string
}>()

defineSlots<{
  header?: () => unknown
  default?: () => unknown
  footer?: () => unknown
}>()
</script>

<template>
  <div class="hf-detail-page -m-4 flex h-[calc(100%+2rem)] min-h-0 flex-col sm:-m-6 sm:h-[calc(100%+3rem)]">
    <div v-if="$slots.header" data-slot="header" class="w-full shrink-0">
      <slot name="header" />
    </div>
    <div
      data-slot="scroll"
      class="w-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
      :data-testid="scrollTestid"
    >
      <slot />
    </div>
    <div v-if="$slots.footer" data-slot="footer" class="w-full shrink-0">
      <slot name="footer" />
    </div>
  </div>
</template>
