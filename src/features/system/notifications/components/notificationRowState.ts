// notificationRowState.ts — PURE helpers for the notification-config UI.
//
// Every component-level derivation that has business meaning lives here as a
// pure function. The SFC is a thin shell — it computes the layout, calls
// these helpers, and forwards the result to props/events.
//
// Why pure and not a composable?
//   - Zero reactivity setup → zero `nextTick()` boilerplate in tests.
//   - Branches over the data shape can be triangulated cheaply (3+ cases).
//   - Reusable from the view if we ever need a "summary" widget.

import type {
  ActionDescriptor,
  ActionKey,
  ModuleDescriptor,
  NotificationConfigForm,
} from '../interfaces/notification-config.types'
import { findActionDescriptor } from '../registry/action-registry'

/**
 * State of a single action row in the accordion.
 *   - `checked`  → does the action live in the user's `enabledActions` set?
 *   - `disabled` → when `masterEnabled` is false, action rows render greyed.
 */
export interface ActionRowState {
  checked: boolean
  disabled: boolean
}

export function computeActionRowState(
  action: ActionDescriptor,
  masterEnabled: boolean,
  enabledActions: readonly string[],
): ActionRowState {
  return {
    checked: enabledActions.includes(action.key),
    disabled: !masterEnabled,
  }
}

/**
 * Per-module count shown in the accordion header (e.g. "1/1").
 * The fraction tells the admin "how many actions of this module are on".
 *
 * Pure: walks the module's actions and counts membership in enabledActions.
 */
export interface ModuleActionCount {
  enabled: number
  total: number
  label: string
}

export function computeModuleActionCount(
  module: ModuleDescriptor,
  enabledActions: readonly string[],
): ModuleActionCount {
  const total = module.actions.length
  const enabled = module.actions.filter((a) => enabledActions.includes(a.key)).length
  return { enabled, total, label: `${enabled}/${total}` }
}

/**
 * Toggle membership of `actionKey` in `enabledActions` and return a NEW
 * array. Caller (the view) owns reactivity — the helper just rebuilds.
 */
export function toggleActionMembership(
  actionKey: string,
  enabledActions: readonly string[],
): string[] {
  return enabledActions.includes(actionKey)
    ? enabledActions.filter((k) => k !== actionKey)
    : [...enabledActions, actionKey]
}
// ─── Redesign helpers (design/notification-config/01 + 04) ───────────────────

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function symmetricDifference(a: readonly string[], b: readonly string[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  return a.filter((x) => !setB.has(x)).length + b.filter((x) => !setA.has(x)).length
}

/**
 * How many changes the save bar reports: the master switch, each added or
 * removed recipient and each added or removed action. Order does not count.
 */
type FormSnapshot = Readonly<{
  enabled: boolean
  recipientUserIds: readonly string[]
  enabledActions: readonly string[]
}>

export function countFormChanges(current: FormSnapshot, pristine: FormSnapshot): number {
  return (
    (current.enabled !== pristine.enabled ? 1 : 0) +
    symmetricDifference(current.recipientUserIds, pristine.recipientUserIds) +
    symmetricDifference(current.enabledActions, pristine.enabledActions)
  )
}

/** The state word of an action row; a kept selection under a master off is «En pausa». */
export function computeActionStateWord(checked: boolean, masterEnabled: boolean): string {
  if (!checked) return 'Desactivado'
  return masterEnabled ? 'Activado' : 'En pausa'
}

/** Why an action row cannot change while the master is off. */
export function computePausedReason(checked: boolean): string {
  return checked
    ? 'En pausa: las notificaciones están desactivadas.'
    : 'No disponible mientras las notificaciones están desactivadas.'
}

export interface ModuleToggleState {
  pressed: 'true' | 'false' | 'mixed'
  on: number
  total: number
}

/** `aria-pressed` of a module «Activar todas»: none, some (mixed) or all on. */
export function computeModuleToggleState(
  module: ModuleDescriptor,
  enabledActions: readonly string[],
): ModuleToggleState {
  const { enabled: on, total } = computeModuleActionCount(module, enabledActions)
  const pressed = on === 0 ? 'false' : on === total ? 'true' : 'mixed'
  return { pressed, on, total }
}

/**
 * Turn every action of `module` on (appended in registry order after the
 * existing keys) or off, leaving the other modules untouched.
 */
export function setModuleActions(
  module: ModuleDescriptor,
  enabledActions: readonly string[],
  on: boolean,
): string[] {
  const keys = module.actions.map((a) => a.key as string)
  if (!on) return enabledActions.filter((k) => !keys.includes(k))
  return [...enabledActions, ...keys.filter((k) => !enabledActions.includes(k))]
}

export interface DeliverySummary {
  tone: 'off' | 'warn' | 'ok'
  icon: string
  title: string
  detail: string
}

const needsRecipients = (key: ActionKey) => findActionDescriptor(key)?.requiresRecipients !== false

/** The one-line effect of the current form, shown under the master switch. */
export function computeDeliverySummary(
  form: NotificationConfigForm,
  knownRecipients: number,
): DeliverySummary {
  const total = form.enabledActions.length
  const toUsers = form.enabledActions.filter(needsRecipients).length
  if (!form.enabled) {
    return {
      tone: 'off',
      icon: 'i-lucide-pause',
      title: 'No se envía ningún aviso.',
      detail: `Tu selección de ${plural(total, 'aviso', 'avisos')} se conserva para cuando las vuelvas a activar.`,
    }
  }
  if (total === 0) {
    return {
      tone: 'warn',
      icon: 'i-lucide-triangle-alert',
      title: 'Activadas, pero sin avisos elegidos.',
      detail: 'Enciende al menos una acción para que llegue algún correo.',
    }
  }
  if (toUsers > 0 && knownRecipients === 0) {
    return {
      tone: 'warn',
      icon: 'i-lucide-triangle-alert',
      title: 'Falta a quién enviar.',
      detail: `${plural(toUsers, 'aviso necesita', 'avisos necesitan')} al menos un usuario.`,
    }
  }
  const toCustomer = form.enabledActions
    .filter((k) => !needsRecipients(k))
    .map((k) => findActionDescriptor(k)?.label)
    .filter((label): label is string => !!label)
  const verb = total === 1 ? 'Se envía' : 'Se envían'
  const users = toUsers > 0 ? ` a ${plural(knownRecipients, 'usuario', 'usuarios')}` : ''
  return {
    tone: 'ok',
    icon: 'i-lucide-circle-check',
    title: `${verb} ${plural(total, 'aviso', 'avisos')} por correo${users}`,
    detail: toCustomer.length
      ? `${toCustomer.join(' y ')} ${toCustomer.length === 1 ? 'va' : 'van'} al cliente.`
      : '',
  }
}

/** Labels of the enabled actions that need recipients («Bajo inventario y …»). */
export function describeActionsNeedingRecipients(enabledActions: readonly ActionKey[]): string {
  const labels = enabledActions
    .filter(needsRecipients)
    .map((k) => findActionDescriptor(k)?.label)
    .filter((label): label is string => !!label)
  if (labels.length === 0) return ''
  if (labels.length === 1) return `${labels[0]} necesita a quién enviarse.`
  return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]} necesitan a quién enviarse.`
}
