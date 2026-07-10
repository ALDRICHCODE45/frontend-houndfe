// action-registry.ts — DATA-DRIVEN registry of notification modules/actions.
//
// This file is the SINGLE extension point when the backend adds a new module
// or action. Adding an entry here propagates to the API contract (ActionKey
// in `interfaces/notification-config.types.ts`), the view's accordion
// rendering, and the dirty-tracking helpers — without any switch/case
// branching elsewhere in the code.
//
// Design rules:
// - The registry is plain data (readonly array of `ModuleDescriptor`).
// - `findActionDescriptor` and `getActionsByKeys` are the SOLE bridges the
//   UI uses to convert `enabledActions: ActionKey[]` into renderable
//   descriptors. They never branch on action key.
// - Lookup is total over the registered keys; unknown keys return
//   `undefined` so the caller can render a warning instead of crashing.

import type {
  ActionDescriptor,
  ActionKey,
  ModuleDescriptor,
} from '../interfaces/notification-config.types'

/**
 * Canonical notification registry. Order is meaningful — the view renders
 * modules top-to-bottom in this order, and the UI uses the first action
 * label as the default copy for inline errors.
 */
export const ACTION_REGISTRY: readonly ModuleDescriptor[] = [
  {
    moduleKey: 'pos',
    moduleLabel: 'Punto de venta',
    actions: [
      {
        key: 'LOW_STOCK',
        label: 'Bajo inventario',
        description:
          'Envía un correo cuando un producto cae por debajo de su inventario mínimo.',
      },
    ],
  },
] as const

/**
 * Flat lookup table rebuilt from `ACTION_REGISTRY`. Computed once at module
 * load (the registry is a frozen const), so per-call lookup is O(1).
 */
const ACTION_LOOKUP: ReadonlyMap<ActionKey, ActionDescriptor> = (() => {
  const map = new Map<ActionKey, ActionDescriptor>()
  for (const module of ACTION_REGISTRY) {
    for (const action of module.actions) {
      map.set(action.key, action)
    }
  }
  return map
})()

/**
 * True if `key` is a registered notification action. Use this in component
 * code to decide whether to render a checkbox vs a "stale" chip when the
 * backend emits an unknown key (it shouldn't, but we never crash).
 */
export function isRegisteredActionKey(key: string): key is ActionKey {
  return ACTION_LOOKUP.has(key as ActionKey)
}

/**
 * Look up an action descriptor by key. Returns `undefined` for unknown
 * keys so the view can render a warning instead of throwing.
 */
export function findActionDescriptor(key: ActionKey): ActionDescriptor | undefined {
  return ACTION_LOOKUP.get(key)
}

/**
 * Convert the backend's `enabledActions: ActionKey[]` payload into a flat
 * ordered list of renderable descriptors. Unknown keys are skipped (the
 * backend must not emit them, but we never crash the UI either).
 *
 * Output order matches the order of the input keys — callers control
 * order, the registry does not.
 */
export function getActionsByKeys(keys: readonly ActionKey[]): ActionDescriptor[] {
  const result: ActionDescriptor[] = []
  for (const key of keys) {
    const descriptor = ACTION_LOOKUP.get(key)
    if (descriptor) result.push(descriptor)
  }
  return result
}
