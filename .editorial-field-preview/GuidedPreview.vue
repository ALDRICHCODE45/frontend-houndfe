<script setup lang="ts">
import UApp from '@nuxt/ui/runtime/components/App.vue'
import { RouterView } from 'vue-router'
</script>
<template><UApp><div class="fixture-shell"><RouterView /></div></UApp></template>
<style>
body { margin: 0; background: var(--hf-page); }
.fixture-shell { padding: 24px; min-height: 100vh; }
@media(max-width: 480px) { .fixture-shell { padding: 16px; } }
</style>
