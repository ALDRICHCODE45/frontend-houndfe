<script setup lang="ts">
/**
 * HfFieldGrid — The field layout of an HfSectionCard: two equal columns from
 * md (20px row gap, 16px column gap), one column below. A child with
 * `span="full"` (long text, a segmented question) spans both columns.
 */
import './hf-form.css'
</script>

<template>
  <div class="hf-field-grid">
    <slot />
  </div>
</template>
