import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { chatbotRequestKeys } from '@/features/chatbot/requests/constants/queryKeys'
import { chatbotSettingsApi } from '../api/chatbotSettings.api'
import { chatbotSettingsKeys } from '../constants/queryKeys'
import type { ChatbotSettings } from '../interfaces/chatbot-settings.types'
import { cloneSettings, diffItems, rebaseDraft, toPutBody } from '../utils/settingsDraft'
import { readSettingsError, saveNotice, type SaveNoticeKind } from '../utils/settingsErrors'
import { validateSettings } from '../utils/settingsValidation'

export type EditorNotice = SaveNoticeKind | 'validation' | 'forbidden' | 'error'

export type SaveOutcome =
  | { status: 'saved'; changed: boolean; notice: SaveNoticeKind | null }
  | { status: 'invalid' | 'conflict' | 'error' | 'skipped' }

export interface ChatbotSettingsEditorOptions {
  /** The last server body (query data). */
  source: Ref<ChatbotSettings | undefined>
  canUpdate: Ref<boolean>
  /** Re-reads the settings (used when a 409 carries no usable `current`). */
  refetch: () => Promise<ChatbotSettings | undefined>
}

/**
 * Owner of the draft: a deep copy of the last accepted body, change tracking, client validation, the
 * full-object `PUT` with `expectedVersion`, and the `409` flow. A refreshed server body replaces a clean
 * draft only; a dirty draft is never overwritten (not by a refetch, not by a failed save).
 */
export function useChatbotSettingsEditor(options: ChatbotSettingsEditorOptions) {
  const queryClient = useQueryClient()
  const tenantId = useSafeTenantId()

  const accepted = shallowRef<ChatbotSettings | null>(null)
  const draft = ref<ChatbotSettings | null>(null)
  const showErrors = ref(false)
  const saving = ref(false)
  const savedAt = ref<number | null>(null)
  const notice = ref<EditorNotice | null>(null)
  const conflict = shallowRef<ChatbotSettings | null>(null)
  const conflictDialogOpen = ref(false)

  const dirtyItems = computed(() =>
    accepted.value && draft.value ? diffItems(accepted.value, draft.value) : [],
  )
  const isDirty = computed(() => dirtyItems.value.length > 0)
  const creating = computed(() => accepted.value?.version === 0)
  /** A version 0 branch has nothing to compare against: its first save is what makes the values its own. */
  const needsSave = computed(() => isDirty.value || creating.value)
  const errors = computed(() => (draft.value ? validateSettings(draft.value) : {}))

  function load(settings: ChatbotSettings) {
    accepted.value = cloneSettings(settings)
    draft.value = cloneSettings(settings)
    showErrors.value = false
  }

  watch(
    options.source,
    (settings) => {
      if (settings && (!draft.value || !isDirty.value)) load(settings)
    },
    { immediate: true },
  )

  function edit(change: (draft: ChatbotSettings) => void) {
    if (!draft.value) return
    change(draft.value)
    savedAt.value = null
    if (Object.keys(errors.value).length === 0) showErrors.value = false
  }

  function discard() {
    if (accepted.value) load(accepted.value)
    notice.value = null
  }

  async function save(): Promise<SaveOutcome> {
    if (saving.value || !options.canUpdate.value || !draft.value || !accepted.value) return { status: 'skipped' }
    if (Object.keys(errors.value).length > 0) {
      showErrors.value = true
      return { status: 'invalid' }
    }
    saving.value = true
    notice.value = null
    try {
      const response = await chatbotSettingsApi.put(toPutBody(draft.value, accepted.value.version))
      const { recompute, ...settings } = response
      const changed = recompute !== 'NOT_NEEDED'
      load(settings)
      savedAt.value = Date.now()
      queryClient.setQueryData(chatbotSettingsKeys.detail(tenantId.value), settings)
      // Deadlines of the open requests were recomputed: the inbox shows the new ones on its next read.
      if (changed) void queryClient.invalidateQueries({ queryKey: chatbotRequestKeys.all(tenantId.value) })
      const raised = saveNotice(recompute)
      notice.value = raised
      return { status: 'saved', changed, notice: raised }
    } catch (err) {
      const error = readSettingsError(err)
      if (error.kind === 'conflict') {
        const current = error.current ?? (await options.refetch().catch(() => undefined)) ?? null
        if (current) {
          conflict.value = current
          conflictDialogOpen.value = true
          return { status: 'conflict' }
        }
        notice.value = 'error'
        return { status: 'conflict' }
      }
      notice.value = error.kind === 'validation' ? 'validation' : error.kind === 'forbidden' ? 'forbidden' : 'error'
      return { status: 'error' }
    } finally {
      saving.value = false
    }
  }

  /** «Conservar mis cambios»: rebase onto the other version, my edits on top. */
  function keepMine() {
    if (!conflict.value || !accepted.value || !draft.value) return
    draft.value = rebaseDraft(accepted.value, draft.value, conflict.value)
    accepted.value = cloneSettings(conflict.value)
    conflict.value = null
    conflictDialogOpen.value = false
  }

  /** «Usar la versión N y descartar lo mío». */
  function useTheirs() {
    if (!conflict.value) return
    load(conflict.value)
    conflict.value = null
    conflictDialogOpen.value = false
    savedAt.value = null
  }

  return {
    accepted,
    draft,
    dirtyItems,
    isDirty,
    creating,
    needsSave,
    errors,
    showErrors,
    saving,
    savedAt,
    notice,
    conflict,
    conflictDialogOpen,
    edit,
    discard,
    save,
    keepMine,
    useTheirs,
    openConflict: () => {
      conflictDialogOpen.value = true
    },
    closeConflict: () => {
      conflictDialogOpen.value = false
    },
    closeNotice: () => {
      notice.value = null
    },
  }
}
