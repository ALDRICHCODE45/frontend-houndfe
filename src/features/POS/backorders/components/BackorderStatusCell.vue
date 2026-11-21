<script setup lang="ts">
/**
 * The per-status cell (S1): WAITING → «#N en la fila» and, when a head keeps being passed over, a
 * warning; RESERVED → «Apartado hasta …»; CONFIRMED → «Ver venta»; EXPIRED / CANCELLED → when, who
 * and why. The warning is amber text, never red.
 */
import { computed } from 'vue'
import type { BackorderStaff } from '../interfaces/backorder.types'
import { backorderStatusInfo } from '../utils/backorderView'

const props = defineProps<{ backorder: BackorderStaff }>()
const info = computed(() => backorderStatusInfo(props.backorder))
</script>

<template>
  <span class="bo-info" data-testid="backorder-info">
    <span v-for="line in info.lines" :key="line" class="bo-info__line">{{ line }}</span>
    <span v-if="info.warning" class="bo-warning" data-testid="backorder-info-warning">{{ info.warning }}</span>
    <RouterLink v-if="info.link" :to="info.link.to" class="bo-link" data-row-ignore @click.stop>{{
      info.link.label
    }}</RouterLink>
  </span>
</template>
