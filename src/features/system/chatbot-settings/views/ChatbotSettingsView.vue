<script setup lang="ts">
/**
 * ChatbotSettingsView — routed surface at /sistema/atencion-chatbot (design direction A, «secciones y barra»):
 * one page, sections in PUT order (horario semanal, fechas cerradas, plazos por tipo, ventana y plantilla,
 * conversaciones agendadas), a side index and a sticky save bar. Composition only: the draft, save and 409 flow
 * live in useChatbotSettingsEditor, the apply-to-all steps in useApplyToAllBranches, and every section is a
 * component. Read-only without `update:ChatbotSettings`; «Aplicar a todas» only with
 * `update:ChatbotSettingsAllBranches`.
 */
import { computed, ref } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import { useChatbotSettingsAccess } from '../composables/useChatbotSettingsAccess'
import { useChatbotSettingsQuery } from '../composables/useChatbotSettingsQuery'
import { useChatbotSettingsEditor } from '../composables/useChatbotSettingsEditor'
import { useApplyToAllBranches } from '../composables/useApplyToAllBranches'
import {
  addClosedDate,
  addRange,
  copyDayRanges,
  copyPickupHours,
  removeClosedDate,
  removePastClosedDates,
  removeRange,
  setClosedDateReason,
  setRangeTime,
  toggleDay,
} from '../utils/settingsDraft'
import { conflictHeadline, formatSavedBy } from '../utils/settingsErrors'
import { errorTarget } from '../utils/settingsErrorTargets'
import { plural, todayIn } from '../utils/settingsLabels'
import { sectionOfError, type ErrorSection } from '../utils/settingsValidation'
import ApplyToAllDialog from '../components/ApplyToAllDialog.vue'
import ClosedDatesSection from '../components/ClosedDatesSection.vue'
import ConflictDialog from '../components/ConflictDialog.vue'
import ExtrasSection from '../components/ExtrasSection.vue'
import HoursSection from '../components/HoursSection.vue'
import PendingBadge from '../components/PendingBadge.vue'
import SchedulingSection from '../components/SchedulingSection.vue'
import SettingsBanners from '../components/SettingsBanners.vue'
import SettingsSaveBar from '../components/SettingsSaveBar.vue'
import SettingsSection from '../components/SettingsSection.vue'
import SettingsSideIndex, { type SideIndexEntry } from '../components/SettingsSideIndex.vue'
import SlaSection from '../components/SlaSection.vue'
import '../styles/chatbot-settings.css'

declare const useToast: () => {
  add: (options: { title: string; description?: string; color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral' }) => void
}

const toast = useToast()
const access = useChatbotSettingsAccess()
const query = useChatbotSettingsQuery()
const editor = useChatbotSettingsEditor({
  source: query.settings,
  canUpdate: access.canUpdate,
  refetch: query.refetch,
})

const readonly = computed(() => !access.canUpdate.value)
const draft = computed(() => editor.draft.value)
/** Client rules plus the located errors of a refused save (400 `fieldErrors`). */
const errors = editor.allErrors
const today = computed(() => todayIn(draft.value?.openingHours.timeZone ?? 'America/Mexico_City'))
const dateError = ref<string | null>(null)
const zone = computed(() => draft.value?.openingHours.timeZone ?? 'America/Mexico_City')
const savedBy = computed(() => {
  const accepted = editor.accepted.value
  return accepted ? formatSavedBy(accepted.updatedBy, accepted.updatedAt, zone.value) : null
})
const conflictLine = computed(() => {
  const current = editor.conflict.value
  return current ? conflictHeadline(current.updatedBy, current.updatedAt, zone.value) : undefined
})

async function save() {
  const outcome = await editor.save()
  if (outcome.status === 'saved') {
    const version = editor.accepted.value?.version ?? 0
    toast.add(
      outcome.changed
        ? { title: 'Cambios guardados', description: `Versión ${version}. Las solicitudes abiertas se recalculan.`, color: 'success' }
        : { title: 'No había cambios', description: 'La configuración ya estaba así; no se creó otra versión.', color: 'neutral' },
    )
  } else if (outcome.status === 'invalid') {
    const first = Object.keys(errors.value)[0]
    if (first) focusFirstError()
  } else if (outcome.status === 'error' && outcome.located && outcome.first) {
    // The server named the fields: scroll to and focus the first one it reported.
    const id = errorTarget(outcome.first).id
    queueMicrotask(() => goto(id))
  }
  return outcome
}

const apply = useApplyToAllBranches({
  canApply: access.canApplyAll,
  canSave: access.canUpdate,
  needsSave: () => editor.needsSave.value,
  version: () => editor.accepted.value?.version ?? 0,
  save,
  refetch: query.refetch,
})

function goto(id: string) {
  const target = document.getElementById(id)
  if (!target) return
  target.scrollIntoView?.({ block: 'center' })
  const focusable = target.matches('input,select,textarea,button') ? target : target.querySelector('input,select,textarea')
  ;(focusable as HTMLElement | null)?.focus?.({ preventScroll: true })
}

function focusFirstError() {
  const first = Object.keys(errors.value)[0]
  if (!first) return
  queueMicrotask(() => {
    const checklist = document.querySelector('[data-testid="error-checklist"] a') as HTMLElement | null
    checklist?.focus()
  })
}

const SECTIONS: Array<{ id: ErrorSection; label: string; icon: string; description: string }> = [
  { id: 'hours', label: 'Horario de atención', icon: 'i-lucide-clock', description: 'Los días y horas en que el chatbot cuenta el tiempo de tus solicitudes.' },
  { id: 'dates', label: 'Fechas cerradas', icon: 'i-lucide-calendar-x', description: 'Días completos sin atención, como feriados.' },
  { id: 'sla', label: 'Plazos por tipo', icon: 'i-lucide-timer', description: 'Cuánto tiempo hay para atender y resolver cada tipo de solicitud.' },
  { id: 'extras', label: 'Ventana y plantilla', icon: 'i-lucide-send', description: 'Aviso de la ventana de WhatsApp y plantilla para escribir después de las 24 h.' },
  { id: 'sched', label: 'Conversaciones agendadas', icon: 'i-lucide-calendar-clock', description: 'Horarios que el cliente puede elegir y su cupo.' },
]

const errorsBySection = computed(() => {
  const counts: Record<ErrorSection, number> = { hours: 0, dates: 0, sla: 0, extras: 0, sched: 0 }
  if (editor.showErrors.value) for (const key of Object.keys(errors.value)) counts[sectionOfError(key)]++
  return counts
})
const dirtyBySection = computed(() => {
  const flags: Record<ErrorSection, boolean> = { hours: false, dates: false, sla: false, extras: false, sched: false }
  for (const entry of editor.dirtyItems.value) flags[entry.sec] = true
  return flags
})
const indexEntries = computed<SideIndexEntry[]>(() =>
  SECTIONS.map((s) => ({ id: s.id, label: s.label, icon: s.icon, dirty: dirtyBySection.value[s.id], errors: errorsBySection.value[s.id] })),
)

function addDate(value: string) {
  dateError.value = null
  editor.edit((d) => {
    dateError.value = addClosedDate(d, value)
  })
}
function removePast() {
  editor.edit((d) => {
    const removed = removePastClosedDates(d, today.value)
    if (removed) toast.add({ title: `Quitamos ${plural(removed, 'fecha pasada', 'fechas pasadas')}`, description: 'Falta guardar.', color: 'neutral' })
  })
}
function copyPickup() {
  editor.edit((d) => {
    if (copyPickupHours(d)) {
      toast.add({ title: 'Horario de recolección copiado', description: 'Está en el editor como borrador; falta guardar. No cambia Envíos.', color: 'neutral' })
    }
  })
}
function copyDays(from: Parameters<typeof copyDayRanges>[1], to: Parameters<typeof copyDayRanges>[2]) {
  editor.edit((d) => copyDayRanges(d, from, to))
  toast.add({ title: 'Horario copiado', description: `A ${plural(to.length, 'día', 'días')}. Falta guardar.`, color: 'neutral' })
}

const applyBusy = computed(() => apply.step.value !== 'closed')
</script>

<template>
  <div id="cbs-page" class="hf-theme hf-ui chatbot-settings cbs-page" data-testid="chatbot-settings-view">
    <header class="hf-page-header cbs-head">
      <div>
        <h1 class="hf-page-title">Atención del chatbot</h1>
        <p class="hf-page-subtitle">
          Horario, fechas cerradas y plazos con los que se miden las solicitudes del chatbot en esta sucursal.
        </p>
        <p v-if="savedBy" class="hf-page-subtitle cbs-saved-by" data-testid="saved-by">{{ savedBy }}</p>
      </div>
      <button
        v-if="access.canRead.value && access.canApplyAll.value && draft"
        type="button"
        class="cbs-btn"
        :disabled="applyBusy || editor.saving.value"
        data-testid="apply-open"
        @click="apply.open()"
      >
        <UIcon name="i-lucide-building-2" class="size-4" aria-hidden="true" />
        Aplicar a todas mis sucursales
      </button>
    </header>

    <EmptyState
      v-if="!access.canRead.value"
      kind="forbidden"
      title="No tienes acceso a esta pantalla"
      description="Pide a quien administra tu rol el permiso «Ver ajustes del chatbot»."
      data-testid="settings-forbidden"
    />

    <div v-else-if="query.isLoading.value" class="cbs-skeleton" role="status" aria-busy="true" data-testid="settings-loading">
      <span class="sr-only">Cargando los ajustes del chatbot…</span>
      <div v-for="n in 3" :key="n" class="cbs-sec cbs-skeleton__sec" aria-hidden="true">
        <span class="cbs-bar" style="width: 30%" />
        <span class="cbs-bar" style="width: 55%" />
        <span class="cbs-bar" style="height: 44px" />
        <span class="cbs-bar" style="height: 44px" />
      </div>
    </div>

    <EmptyState
      v-else-if="query.isError.value"
      kind="error"
      title="No pudimos cargar los ajustes"
      description="No se cambió nada. Revisa tu conexión e inténtalo de nuevo."
      action-label="Reintentar"
      action-test-id="retry-button"
      data-testid="settings-error"
      @action="query.refetch()"
    />

    <template v-else-if="draft && editor.accepted.value">
      <SettingsBanners
        :readonly="readonly"
        :creating="editor.creating.value"
        :notice="editor.notice.value"
        :version="editor.accepted.value.version"
        :conflict-version="editor.conflict.value && !editor.conflictDialogOpen.value ? editor.conflict.value.version : null"
        :conflict-headline="conflictLine"
        :errors="errors"
        :show-errors="editor.showErrors.value"
        @close-notice="editor.closeNotice()"
        @retry-save="save()"
        @open-conflict="editor.openConflict()"
        @goto="goto"
      />

      <div class="cbs-grid-page">
        <SettingsSideIndex :sections="indexEntries" @navigate="goto" />

        <div class="cbs-main">
          <SettingsSection
            id="hours"
            :title="SECTIONS[0]!.label"
            :description="SECTIONS[0]!.description"
            :dirty="dirtyBySection.hours"
            :errors="errorsBySection.hours"
          >
            <HoursSection
              :draft="draft"
              :readonly="readonly"
              :errors="errors"
              @toggle-day="(day) => editor.edit((d) => toggleDay(d, day))"
              @add-range="(day) => editor.edit((d) => addRange(d, day))"
              @remove-range="(day, index) => editor.edit((d) => removeRange(d, day, index))"
              @set-time="(day, index, part, value) => editor.edit((d) => setRangeTime(d, day, index, part, value))"
              @set-zone="(zone) => editor.edit((d) => (d.openingHours.timeZone = zone))"
              @copy-pickup="copyPickup"
              @copy-days="copyDays"
            />
          </SettingsSection>

          <SettingsSection
            id="dates"
            :title="SECTIONS[1]!.label"
            :description="SECTIONS[1]!.description"
            :dirty="dirtyBySection.dates"
            :errors="errorsBySection.dates"
          >
            <ClosedDatesSection
              :dates="draft.closedDates"
              :today="today"
              :readonly="readonly"
              :add-error="dateError"
              :list-error="errors['d:list']"
              :reasons="draft.closedDateReasons"
              :errors="errors"
              @add="addDate"
              @set-reason="(date, value) => editor.edit((d) => setClosedDateReason(d, date, value))"
              @remove="(date) => editor.edit((d) => removeClosedDate(d, date))"
              @remove-past="removePast"
            />
          </SettingsSection>

          <SettingsSection
            id="sla"
            :title="SECTIONS[2]!.label"
            :description="SECTIONS[2]!.description"
            :dirty="dirtyBySection.sla"
            :errors="errorsBySection.sla"
          >
            <SlaSection
              :draft="draft"
              :readonly="readonly"
              :errors="errors"
              @set-sla="
                (subtype, field, value) =>
                  editor.edit((d) => {
                    const sla = d.slas.find((s) => s.subtype === subtype)
                    if (sla) sla[field] = value
                  })
              "
              @set-margin="(value) => editor.edit((d) => (d.receiptCloseMarginMinutes = value))"
            />
          </SettingsSection>

          <SettingsSection
            id="extras"
            :title="SECTIONS[3]!.label"
            :description="SECTIONS[3]!.description"
            :dirty="dirtyBySection.extras"
            :errors="errorsBySection.extras"
          >
            <ExtrasSection
              :draft="draft"
              :readonly="readonly"
              :errors="errors"
              @set-window="(value) => editor.edit((d) => (d.windowWarningMinutes = value))"
              @set-template-name="(value) => editor.edit((d) => (d.templateName = value))"
              @set-template-cost="(value) => editor.edit((d) => (d.templateCostText = value))"
              @set-template-language="(value) => editor.edit((d) => (d.templateLanguageCode = value))"
              @set-start-timeout="(value) => editor.edit((d) => (d.startTimeoutSeconds = value))"
            />
          </SettingsSection>

          <SettingsSection
            id="sched"
            :title="SECTIONS[4]!.label"
            :description="SECTIONS[4]!.description"
            :dirty="dirtyBySection.sched"
            :errors="errorsBySection.sched"
          >
            <template #tag><PendingBadge /></template>
            <SchedulingSection
              :scheduling="draft.scheduling"
              :readonly="readonly"
              :errors="errors"
              @set-enabled="(value) => editor.edit((d) => (d.scheduling.enabled = value))"
              @set-field="(field, value) => editor.edit((d) => (d.scheduling[field] = value))"
            />
          </SettingsSection>
        </div>
      </div>

      <SettingsSaveBar
        v-if="!readonly"
        :items="editor.dirtyItems.value"
        :creating="editor.creating.value"
        :saving="editor.saving.value"
        :saved="editor.savedAt.value !== null"
        :version="editor.accepted.value.version"
        :error-count="Object.keys(errors).length"
        :show-errors="editor.showErrors.value"
        @save="save()"
        @discard="editor.discard()"
      />

      <ApplyToAllDialog
        :step="apply.step.value"
        :result="apply.result.value"
        :error-kind="apply.errorKind.value"
        :dirty-count="editor.dirtyItems.value.length"
        :creating="editor.creating.value"
        :version="editor.accepted.value.version"
        @save-first="apply.saveFirst()"
        @confirm="apply.confirm()"
        @retry="apply.retry()"
        @close="apply.close()"
      />

      <ConflictDialog
        :open="editor.conflictDialogOpen.value"
        :base="editor.accepted.value"
        :mine="draft"
        :theirs="editor.conflict.value"
        @keep-mine="editor.keepMine()"
        @use-theirs="editor.useTheirs()"
        @close="editor.closeConflict()"
      />
    </template>
  </div>
</template>
