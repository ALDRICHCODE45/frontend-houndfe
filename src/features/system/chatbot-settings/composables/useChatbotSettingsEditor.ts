import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { chatbotRequestKeys } from '@/features/chatbot/requests/constants/queryKeys'
import { chatbotSettingsApi } from '../api/chatbotSettings.api'
import { chatbotSettingsKeys } from '../constants/queryKeys'
import type { ChatbotSettings } from '../interfaces/chatbot-settings.types'
import { cloneSettings, diffItems, rebaseDraft, toPutBody } from '../utils/settingsDraft'
import { readSettingsError, saveNotice, type SaveNoticeKind } from '../utils/settingsErrors'
import { mapFieldErrors } from '../utils/settingsFieldErrors'
import { validateSettings, type SettingsErrors } from '../utils/settingsValidation'

export type EditorNotice = SaveNoticeKind | 'validation' | 'forbidden' | 'error'

export type SaveOutcome =
  | { status: 'saved'; changed: boolean; notice: SaveNoticeKind | null }
  /** `located`: a 400 whose `fieldErrors` reached at least one field; `first` is its form key. */
  | { status: 'error'; located?: boolean; first?: string | null }
  | { status: 'invalid' | 'conflict' | 'skipped' }

/** Which server-error keys a changed item (a `diffItems` key) can have fixed. */
function clearsKey(changed: string, errorKey: string): boolean {
  const [kind, name] = changed.split(':')
  if (kind === 'h' && name) return errorKey === `h:${name}` || errorKey === 'h:week'
  if (changed === 'tz') return errorKey === 'h:tz'
  if (changed === 'dates') return errorKey === 'd:list' || errorKey.startsWith('r:')
  if (kind === 's' && name) return errorKey.startsWith(`s:${name}:`)
  if (changed === 'sched') return errorKey.startsWith('c:')
  const scalar: Record<string, string> = {
    'x:receiptCloseMarginMinutes': 'x:margin',
    'x:windowWarningMinutes': 'x:window',
    'x:templateName': 'x:template',
    'x:templateCostText': 'x:templateCost',
  }
  return scalar[changed] === errorKey
}

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
  /** Located errors of the last refused `PUT` (`400 fieldErrors`), by form key. Cleared as the fields are edited. */
  const serverErrors = ref<SettingsErrors>({})
  /** What the form shows: the client rules first, then what only the server could tell. */
  const allErrors = computed<SettingsErrors>(() => ({ ...serverErrors.value, ...errors.value }))

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
    const before = Object.keys(serverErrors.value).length ? cloneSettings(draft.value) : null
    change(draft.value)
    savedAt.value = null
    if (before) {
      const changed = diffItems(before, draft.value).map((item) => item.key)
      serverErrors.value = Object.fromEntries(
        Object.entries(serverErrors.value).filter(([key]) => !changed.some((item) => clearsKey(item, key))),
      )
    }
    if (Object.keys(allErrors.value).length === 0) showErrors.value = false
  }

  function discard() {
    if (accepted.value) load(accepted.value)
    notice.value = null
    serverErrors.value = {}
  }

  async function save(): Promise<SaveOutcome> {
    if (saving.value || !options.canUpdate.value || !draft.value || !accepted.value) return { status: 'skipped' }
    if (Object.keys(errors.value).length > 0) {
      showErrors.value = true
      return { status: 'invalid' }
    }
    saving.value = true
    notice.value = null
    serverErrors.value = {}
    const sent = toPutBody(draft.value, accepted.value.version)
    try {
      const response = await chatbotSettingsApi.put(sent)
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
      if (error.kind === 'validation') {
        const mapped = mapFieldErrors(error.fieldErrors, sent)
        const located = mapped.first !== null
        serverErrors.value = mapped.errors
        if (located) showErrors.value = true
        // The checklist is the notice when every error found its field; otherwise keep the generic one too.
        notice.value = !located || mapped.unmapped > 0 ? 'validation' : null
        return { status: 'error', located, first: mapped.first }
      }
      notice.value = error.kind === 'forbidden' ? 'forbidden' : 'error'
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
    serverErrors,
    allErrors,
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
