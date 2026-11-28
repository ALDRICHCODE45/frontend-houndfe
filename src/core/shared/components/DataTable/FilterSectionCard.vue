<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <!-- Titled section (mobile, inside the filters bottom-sheet): the sheet is the
       surface, so groups are split by a hairline, never a nested card. On desktop
       (md+) the wrapper becomes transparent (display: contents, no border box) and
       the title is hidden, so the raw filters render inline in the toolbar exactly
       as they did before the mobile sheet. -->
  <div class="w-full border-t border-default pt-4 first:border-t-0 first:pt-0 md:contents">
    <p v-if="title" class="mb-4 text-sm font-semibold text-highlighted md:hidden">{{ title }}</p>
    <slot />
  </div>
</template>
