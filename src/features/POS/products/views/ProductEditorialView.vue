<script setup lang="ts">
import { useRoute } from 'vue-router'
import EditorialWorkspace from '../components/editorial/EditorialWorkspace.vue'
const route = useRoute()
</script>

<template>
  <EditorialWorkspace :product-id="typeof route.params.id === 'string' ? route.params.id : ''" />
</template>
