<script setup lang="ts">
/**
 * RequestsListPausedBanner — out-of-hours notice (design 01 `hoursBanner`). Shown while the
 * visible open rows carry `slaPaused`; the resume time is the server's `slaResumesAt`.
 */
import { computed } from 'vue'
import { formatWhen } from '../utils/requestLabels'

const props = withDefaults(
  defineProps<{
    /** `slaResumesAt` of a paused row; `null` when the server sent none. */
    resumesAt: string | null
    /** Injected "current" instant (tests); defaults to the real clock. */
    now?: Date
    /** IANA zone for the time; defaults to the runtime zone. */
    timeZone?: string
  }>(),
  { now: undefined, timeZone: undefined },
)

const resumes = computed(() => formatWhen(props.resumesAt, { now: props.now, timeZone: props.timeZone }))
</script>

<template>
  <div class="chatbot-alert" data-testid="paused-banner" role="status">
    <UIcon name="i-lucide-moon" class="chatbot-alert__icon" aria-hidden="true" />
    <div>
      <strong>Fuera de horario de atención</strong>
      Los tiempos límite están en pausa<template v-if="resumes"> y se reanudan {{ resumes }}</template>.
      Las solicitudes ya vencidas siguen marcadas como vencidas.
    </div>
  </div>
</template>
