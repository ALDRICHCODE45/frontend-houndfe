// recipientSelectState.ts — PURE helpers for the recipient multi-select.
//
// Extracted from RecipientSelect.vue so the stale-id detection logic and
// the USelectMenu options derivation are testable in isolation, with no
// Nuxt UI mount overhead.

import type { AssignableUser } from '@/features/POS/users/interfaces/user.types'

/** A resolved recipient row — name if available, otherwise a stale marker. */
export interface ResolvedRecipient {
  id: string
  label: string
  isStale: boolean
}

/**
 * Build the list of USelectMenu options (one per assignable user).
 * `value` is the user id; `label` is the user name.
 *
 * The multi-select uses the assignable list as the source of truth for
 * dropdown choices. Stale ids never appear as dropdown options — they only
 * surface as rendered chips below the trigger (see `resolveSelectedRows`).
 */
export function computeRecipientOptions(
  assignable: readonly AssignableUser[],
): Array<{ value: string; label: string }> {
  return assignable.map((u) => ({ value: u.id, label: u.name }))
}

/**
 * Resolve the currently-selected recipient ids into renderable rows.
 *
 * For each selected id:
 *   - present in `assignable` → label is the user name (`isStale: false`).
 *   - absent from `assignable` → label is the stale copy (`isStale: true`).
 *
 * Per spec REQ-5: stale ids are NEVER auto-removed. They render as chips so
 * the admin can decide whether to remove them. Order matches `selectedIds`.
 */
export function resolveSelectedRows(
  selectedIds: readonly string[],
  assignable: readonly AssignableUser[],
): ResolvedRecipient[] {
  const byId = new Map(assignable.map((u) => [u.id, u.name]))
  // Local copy of the import — keeps the file standalone-friendly for tests
  // that don't pull in copy.ts.
  const staleLabel = 'Usuario no disponible'
  return selectedIds.map((id) => {
    const name = byId.get(id)
    return name !== undefined
      ? { id, label: name, isStale: false }
      : { id, label: staleLabel, isStale: true }
  })
}

/**
 * Return just the ids in `selectedIds` that are NOT in `assignable`.
 * Used by tests + the field-level error wiring (pure check).
 */
export function detectStaleRecipientIds(
  selectedIds: readonly string[],
  assignable: readonly AssignableUser[],
): string[] {
  const known = new Set(assignable.map((u) => u.id))
  return selectedIds.filter((id) => !known.has(id))
}