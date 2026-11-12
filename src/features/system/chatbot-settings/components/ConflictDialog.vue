<script setup lang="ts">
/**
 * ConflictDialog — «Otra persona guardó antes que tú» (409 VERSION_CONFLICT). Compares the version the user
 * started from, the draft and the version that was saved first: what only they changed, what only the other
 * person changed, what both did. «Conservar mis cambios» rebases the draft on the new version (mine win where
 * both changed); «Usar la versión N» drops the draft. Nothing is sent from here.
 */
import { computed } from 'vue'
import type { ChatbotSettings } from '../interfaces/chatbot-settings.types'
import { conflictGroups, describeValue } from '../utils/settingsCompare'

const props = defineProps<{
  open: boolean
  base: ChatbotSettings | null
  mine: ChatbotSettings | null
  theirs: ChatbotSettings | null
}>()
const emit = defineEmits<{ 'keep-mine': []; 'use-theirs': []; close: [] }>()

const groups = computed(() =>
  props.base && props.mine && props.theirs ? conflictGroups(props.base, props.mine, props.theirs) : null,
)
</script>

<template>
  <UModal
    :open="open && !!theirs"
    title="Otra persona guardó antes que tú"
    :ui="{ content: 'hf-theme hf-ui hf-form-overlay chatbot-settings-dialog' }"
    @update:open="(value: boolean) => !value && emit('close')"
  >
    <template #description>
      <span class="sr-only">Compara tus cambios con la versión que se guardó primero.</span>
    </template>

    <template #body>
      <div v-if="theirs && base && mine && groups" class="cbs-dialog" data-testid="conflict-dialog">
        <p>
          Mientras editabas se guardó la <b>versión {{ theirs.version }}</b> (la tuya partía de la {{ base.version }}).
          No se envió nada: tus cambios siguen aquí.
        </p>
        <section v-if="groups.onlyMine.length" class="cbs-branches" data-testid="conflict-only-mine">
          <h3>Solo cambiaste tú <span class="cbs-figure">{{ groups.onlyMine.length }}</span></h3>
          <ul>
            <li v-for="entry in groups.onlyMine" :key="entry.key"><b>{{ entry.label }}</b><span>se conserva</span></li>
          </ul>
        </section>
        <section v-if="groups.onlyTheirs.length" class="cbs-branches" data-testid="conflict-only-theirs">
          <h3>Solo cambió la otra persona <span class="cbs-figure">{{ groups.onlyTheirs.length }}</span></h3>
          <ul>
            <li v-for="entry in groups.onlyTheirs" :key="entry.key">
              <b>{{ entry.label }}</b><span>{{ describeValue(theirs, entry.key) || 'cambió' }}</span>
            </li>
          </ul>
        </section>
        <section v-if="groups.both.length" class="cbs-branches" data-testid="conflict-both">
          <h3>Cambiaron los dos <span class="cbs-figure">{{ groups.both.length }}</span></h3>
          <ul>
            <li v-for="entry in groups.both" :key="entry.key">
              <b>{{ entry.label }}</b>
              <span>tú: {{ describeValue(mine, entry.key) }} · otra persona: {{ describeValue(theirs, entry.key) }}</span>
            </li>
          </ul>
        </section>
        <p class="cbs-help">
          Si conservas tus cambios, tus valores reemplazan los de la otra persona donde cambiaron los dos. Revisa y guarda
          de nuevo.
        </p>
      </div>
    </template>

    <template #footer>
      <div v-if="theirs" class="cbs-dialog__foot">
        <button type="button" class="cbs-btn" data-testid="conflict-use-theirs" @click="emit('use-theirs')">
          Usar la versión {{ theirs.version }} y descartar lo mío
        </button>
        <button type="button" class="cbs-btn cbs-btn--primary" data-testid="conflict-keep-mine" @click="emit('keep-mine')">
          Conservar mis cambios
        </button>
      </div>
    </template>
  </UModal>
</template>
