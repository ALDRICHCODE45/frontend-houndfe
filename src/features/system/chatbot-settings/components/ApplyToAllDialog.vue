<script setup lang="ts">
/**
 * ApplyToAllDialog — «Aplicar a todas mis sucursales» (handoff 16 §5, design 01). One dialog, one step at a
 * time: save first, reviewing (dry run), review (who changes / is unchanged / is skipped), applying, the
 * per-branch result (including the partial one), and the conflict / error steps. Only branches the user has
 * a membership in are ever listed; the copy says the others are not reached. Props down, events up.
 */
import { computed } from 'vue'
import type { ApplyStep } from '../composables/useApplyToAllBranches'
import type { ChatbotApplyResult, ChatbotApplySkipReason } from '../interfaces/chatbot-settings.types'
import { applyErrorMessage, type SettingsErrorKind } from '../utils/settingsErrors'
import { plural } from '../utils/settingsLabels'

const props = defineProps<{
  step: ApplyStep
  result: ChatbotApplyResult | null
  errorKind: SettingsErrorKind | null
  dirtyCount: number
  creating: boolean
  version: number
}>()
const emit = defineEmits<{ 'save-first': []; confirm: []; retry: []; close: [] }>()

const REASON: Record<ChatbotApplySkipReason, string> = {
  NO_PERMISSION: 'No tienes permiso para aplicar ahí',
  TENANT_INACTIVE: 'Sucursal desactivada',
}
const RECOMPUTE: Record<string, string> = {
  DONE: 'Aplicada',
  PARTIAL: 'Aplicada; algunas solicitudes se actualizan después',
  FAILED: 'Guardada; los plazos de sus solicitudes abiertas se actualizarán más tarde',
}

const open = computed(() => props.step !== 'closed')
const busy = computed(() => props.step === 'loading' || props.step === 'applying')
const failed = computed(() => props.result?.tenantsFailed.length ?? 0)
const applied = computed(() => props.result?.tenantsApplied ?? [])
const recomputeFailed = computed(() => applied.value.filter((a) => a.recompute === 'FAILED'))

const title = computed(() => {
  switch (props.step) {
    case 'save-first': return 'Guardar y revisar'
    case 'blocked': return 'Primero hay que guardar la configuración'
    case 'loading': return 'Revisando sucursales'
    case 'applying': return 'Aplicando…'
    case 'conflict': return 'La configuración cambió'
    case 'error': return 'No se pudo completar'
    case 'result': return failed.value ? 'Se aplicó en algunas sucursales' : 'Configuración aplicada'
    case 'review': return applied.value.length ? `Aplicar a ${plural(applied.value.length, 'sucursal', 'sucursales')}` : 'Nada que aplicar'
    default: return ''
  }
})

function onOpenChange(value: boolean) {
  if (!value && !busy.value) emit('close')
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :dismissible="!busy"
    :close="!busy"
    :ui="{ content: 'hf-theme hf-ui hf-form-overlay chatbot-settings-dialog' }"
    @update:open="onOpenChange"
  >
    <template #description>
      <span class="sr-only">Aplicar la configuración guardada a las demás sucursales donde tienes membresía.</span>
    </template>

    <template #body>
      <div class="cbs-dialog" :data-step="step" data-testid="apply-dialog">
        <template v-if="step === 'save-first'">
          <p v-if="dirtyCount">
            Aplicar copia la configuración <b>guardada</b> de esta sucursal, y tienes
            {{ plural(dirtyCount, 'cambio sin guardar', 'cambios sin guardar') }}.
          </p>
          <p v-else>Esta sucursal aún no tiene configuración guardada, y aplicar copia la <b>guardada</b>.</p>
          <p class="cbs-help">Primero se guardan tus cambios y luego verás a qué sucursales llegarían, antes de confirmar nada.</p>
        </template>

        <div v-else-if="step === 'blocked'" class="cbs-alert" data-tone="warn" role="alert" data-testid="apply-blocked">
          <UIcon name="i-lucide-lock" class="cbs-alert__icon" aria-hidden="true" />
          <div>
            <strong>Esta sucursal aún no tiene configuración guardada</strong>
            «Aplicar a todas» copia la configuración guardada, y tu rol no puede guardar los ajustes del chatbot. Pide que
            alguien con permiso para editar los ajustes del chatbot la guarde primero; después podrás aplicarla.
          </div>
        </div>

        <div v-else-if="busy" class="cbs-wait" role="status">
          <span class="cbs-spinner" aria-hidden="true" />
          <span v-if="step === 'loading'">Calculando qué cambiaría en cada sucursal. No se escribe nada todavía.</span>
          <span v-else>Copiando la configuración. Cada sucursal se guarda por separado.</span>
        </div>

        <template v-else-if="step === 'conflict'">
          <div class="cbs-alert" data-tone="warn" role="alert">
            <UIcon name="i-lucide-triangle-alert" class="cbs-alert__icon" aria-hidden="true" />
            <div>
              <strong>Alguien guardó otra versión mientras revisabas</strong>
              No se copió nada. Recarga la configuración y repite la revisión.
            </div>
          </div>
          <p class="cbs-help">
            Si tu rol puede ver los ajustes se recargan solos; si no, repite la revisión para ver a qué sucursales llegaría.
          </p>
        </template>

        <div v-else-if="step === 'error' && errorKind" class="cbs-alert" data-tone="danger" role="alert" data-testid="apply-error">
          <UIcon name="i-lucide-circle-alert" class="cbs-alert__icon" aria-hidden="true" />
          <div>{{ applyErrorMessage(errorKind) }}</div>
        </div>

        <template v-else-if="result && (step === 'review' || step === 'result')">
          <template v-if="step === 'review' && !applied.length">
            <div class="cbs-alert" data-tone="success" role="status">
              <UIcon name="i-lucide-circle-check" class="cbs-alert__icon" aria-hidden="true" />
              <div>
                <strong>Tus demás sucursales ya tienen esta configuración</strong>
                No se cambiaría nada en {{ plural(result.tenantsUnchanged.length, 'sucursal', 'sucursales') }}.
              </div>
            </div>
          </template>

          <template v-else-if="step === 'review'">
            <p>
              Se copia la configuración guardada de esta sucursal (versión {{ result.source.version }}). Esto
              <b>reemplaza</b> esos valores en las sucursales de abajo y recalcula sus solicitudes abiertas.
            </p>
            <div class="cbs-copies">
              <div>
                <h3>Se copia</h3>
                <ul>
                  <li>Horario y zona horaria</li>
                  <li>Fechas cerradas</li>
                  <li>Plazos por tipo y margen de comprobantes</li>
                  <li>Aviso de ventana</li>
                  <li>Conversaciones agendadas</li>
                </ul>
              </div>
              <div>
                <h3>Se queda en cada sucursal</h3>
                <ul>
                  <li>Plantilla y su texto de costo</li>
                  <li>Tipos de solicitud habilitados</li>
                </ul>
              </div>
            </div>
          </template>

          <div v-else class="cbs-alert" :data-tone="failed ? 'warn' : 'success'" role="status" data-testid="apply-result-summary">
            <UIcon :name="failed ? 'i-lucide-triangle-alert' : 'i-lucide-circle-check'" class="cbs-alert__icon" aria-hidden="true" />
            <div>
              <strong>
                {{ plural(applied.length, 'sucursal recibió', 'sucursales recibieron') }} los cambios{{
                  failed ? ` y ${plural(failed, 'falló', 'fallaron')}` : ''
                }}
              </strong>
              <template v-if="failed">
                Lo que falló no se guardó en esas sucursales. Es seguro reintentar: la operación se puede repetir.
              </template>
              <template v-else-if="recomputeFailed.length || applied.some((a) => a.recompute === 'PARTIAL')">
                Revisa los avisos de abajo.
              </template>
              <template v-else>Los plazos de sus solicitudes abiertas ya están al día.</template>
            </div>
          </div>

          <section v-if="applied.length" class="cbs-branches" data-testid="branches-applied">
            <h3>{{ step === 'review' ? 'Cambiarán' : 'Aplicadas' }} <span class="cbs-figure">{{ applied.length }}</span></h3>
            <ul>
              <li v-for="b in applied" :key="b.tenantId" :data-tone="b.recompute && b.recompute !== 'DONE' ? 'warn' : 'go'">
                <b>{{ b.name }}</b>
                <span>{{ step === 'review' ? 'Recibirá los cambios' : RECOMPUTE[b.recompute ?? 'DONE'] }}</span>
              </li>
            </ul>
          </section>
          <section v-if="result.tenantsFailed.length" class="cbs-branches" data-testid="branches-failed">
            <h3>No se guardó <span class="cbs-figure">{{ result.tenantsFailed.length }}</span></h3>
            <ul>
              <li v-for="b in result.tenantsFailed" :key="b.tenantId" data-tone="bad">
                <b>{{ b.name }}</b><span>No se pudo guardar en esta sucursal</span>
              </li>
            </ul>
          </section>
          <section v-if="result.tenantsSkipped.length" class="cbs-branches" data-testid="branches-skipped">
            <h3>No se pueden cambiar <span class="cbs-figure">{{ result.tenantsSkipped.length }}</span></h3>
            <ul>
              <li v-for="b in result.tenantsSkipped" :key="b.tenantId" data-tone="warn">
                <b>{{ b.name }}</b><span>{{ REASON[b.reason] }}</span>
              </li>
            </ul>
          </section>
          <section v-if="result.tenantsUnchanged.length" class="cbs-branches" data-testid="branches-unchanged">
            <h3>{{ step === 'review' ? 'Ya igual' : 'Sin cambios' }} <span class="cbs-figure">{{ result.tenantsUnchanged.length }}</span></h3>
            <ul>
              <li v-for="b in result.tenantsUnchanged" :key="b.tenantId" data-tone="mute">
                <b>{{ b.name }}</b><span>{{ b.tenantId === result.source.tenantId ? 'Esta sucursal (origen)' : 'Ya igual' }}</span>
              </li>
            </ul>
          </section>

          <p v-if="step === 'review'" class="cbs-help">
            Solo se incluyen las sucursales donde tienes membresía y permiso. Las demás no aparecen ni se cuentan.
          </p>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="cbs-dialog__foot">
        <template v-if="step === 'save-first'">
          <button type="button" class="cbs-btn" data-testid="apply-cancel" @click="emit('close')">Cancelar</button>
          <button type="button" class="cbs-btn cbs-btn--primary" data-testid="apply-save-first" @click="emit('save-first')">
            Guardar y revisar
          </button>
        </template>
        <button v-else-if="step === 'blocked'" type="button" class="cbs-btn cbs-btn--primary" data-testid="apply-close" @click="emit('close')">
          Entendido
        </button>
        <button v-else-if="busy" type="button" class="cbs-btn" disabled>{{ step === 'loading' ? 'Cancelar' : 'Un momento…' }}</button>
        <template v-else-if="step === 'conflict' || step === 'error'">
          <button type="button" class="cbs-btn" data-testid="apply-close" @click="emit('close')">Cerrar</button>
          <button type="button" class="cbs-btn cbs-btn--primary" data-testid="apply-retry" @click="emit('retry')">
            {{ step === 'conflict' ? 'Volver a revisar' : 'Reintentar' }}
          </button>
        </template>
        <template v-else-if="step === 'review' && applied.length">
          <button type="button" class="cbs-btn" data-testid="apply-cancel" @click="emit('close')">Cancelar</button>
          <button type="button" class="cbs-btn cbs-btn--primary" data-testid="apply-confirm" @click="emit('confirm')">
            Aplicar a {{ plural(applied.length, 'sucursal', 'sucursales') }}
          </button>
        </template>
        <template v-else>
          <button v-if="step === 'result' && failed" type="button" class="cbs-btn" data-testid="apply-retry-failed" @click="emit('confirm')">
            Reintentar las que fallaron
          </button>
          <button type="button" class="cbs-btn cbs-btn--primary" data-testid="apply-done" @click="emit('close')">
            {{ step === 'result' ? 'Listo' : 'Entendido' }}
          </button>
        </template>
      </div>
    </template>
  </UModal>
</template>
