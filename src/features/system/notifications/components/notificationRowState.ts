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

import type { ActionDescriptor, ModuleDescriptor } from '../interfaces/notification-config.types'

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