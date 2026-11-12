import { ref, shallowRef, toValue, type MaybeRefOrGetter } from 'vue'
import { chatbotSettingsApi } from '../api/chatbotSettings.api'
import type { ChatbotApplyResult, ChatbotSettings } from '../interfaces/chatbot-settings.types'
import { readSettingsError, type SettingsErrorKind } from '../utils/settingsErrors'
import type { SaveOutcome } from './useChatbotSettingsEditor'

export type ApplyStep =
  | 'closed'
  | 'save-first'
  | 'loading'
  | 'review'
  | 'applying'
  | 'result'
  | 'conflict'
  | 'error'
  /** Needs saving, but the user may not edit the settings: someone who can must save them first. */
  | 'blocked'

export interface ApplyToAllOptions {
  /** `update:ChatbotSettingsAllBranches`. */
  canApply: MaybeRefOrGetter<boolean>
  /** `update:ChatbotSettings`: without it the user cannot save, only apply what is already saved. */
  canSave: MaybeRefOrGetter<boolean>
  /** Unsaved changes, or a version 0 that was never saved: apply copies what is SAVED. */
  needsSave: () => boolean
  /** The version of THIS branch on screen (`expectedVersion`). */
  version: () => number
  save: () => Promise<SaveOutcome>
  refetch: () => Promise<ChatbotSettings | undefined>
}

/**
 * «Aplicar a todas mis sucursales» (handoff 16 §5): save first when needed, dry run with
 * `expectedVersion`, show who changes / is skipped, confirm, apply, show the per-branch result. The
 * real run is idempotent on the server, so «retry the failed ones» repeats the same call. A stale
 * version answers `409`, with `current` only when the user may read the settings: both are handled.
 */
export function useApplyToAllBranches(options: ApplyToAllOptions) {
  const step = ref<ApplyStep>('closed')
  const result = shallowRef<ChatbotApplyResult | null>(null)
  const errorKind = ref<SettingsErrorKind | null>(null)
  let lastCall: 'dry' | 'real' = 'dry'
  /** The version the preview showed: the real run applies exactly that, never a newer one on screen. */
  let previewVersion: number | null = null
  let run = 0

  function fail(err: unknown, call: 'dry' | 'real') {
    lastCall = call
    const { kind } = readSettingsError(err)
    errorKind.value = kind
    step.value = kind === 'conflict' ? 'conflict' : 'error'
  }

  async function dryRun() {
    const token = ++run
    lastCall = 'dry'
    errorKind.value = null
    step.value = 'loading'
    try {
      const data = await chatbotSettingsApi.applyToAllBranches({ dryRun: true, expectedVersion: options.version() })
      if (token !== run) return
      result.value = data
      previewVersion = data.source.version
      step.value = 'review'
    } catch (err) {
      if (token === run) fail(err, 'dry')
    }
  }

  async function confirm() {
    const token = ++run
    lastCall = 'real'
    errorKind.value = null
    step.value = 'applying'
    try {
      const data = await chatbotSettingsApi.applyToAllBranches({ expectedVersion: previewVersion ?? options.version() })
      if (token !== run) return
      result.value = data
      step.value = 'result'
    } catch (err) {
      if (token === run) fail(err, 'real')
    }
  }

  async function open() {
    if (!toValue(options.canApply)) return
    result.value = null
    previewVersion = null
    if (options.needsSave()) {
      step.value = toValue(options.canSave) ? 'save-first' : 'blocked'
      return
    }
    await dryRun()
  }

  async function saveFirst() {
    if (step.value !== 'save-first') return
    const token = ++run
    const outcome = await options.save()
    if (token !== run) return
    if (outcome.status === 'saved' && !outcome.notice) await dryRun()
    else close()
  }

  async function retry() {
    if (step.value === 'conflict') {
      await options.refetch().catch(() => undefined)
      await dryRun()
    } else if (lastCall === 'dry') await dryRun()
    else await confirm()
  }

  function close() {
    run++
    previewVersion = null
    step.value = 'closed'
    result.value = null
    errorKind.value = null
  }

  return { step, result, errorKind, open, saveFirst, confirm, retry, close }
}
