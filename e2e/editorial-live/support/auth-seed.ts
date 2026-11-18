/**
 * Actor auth seeding for the editorial-live journey (modeled on `e2e/cash-live/support/auth-seed.ts`).
 *
 * Reproduces the existing `hound.auth.*` localStorage contract through the frozen key set of
 * `e2e/responsive/fixtures/auth.ts` (read-only import). Values come only from the validated
 * backend-issued actor; nothing is invented or logged.
 *
 * - `isSuperAdmin` is the fixture's access-token claim, written as the app stores it.
 * - Global mode (`superadmin-global`) is a session with NO current tenant: the key is removed, so
 *   the store hydrates `currentTenant = null` exactly as after the sidebar «(Global)» switch.
 * - Access-only: `refreshToken` and `tempToken` are always removed, never written.
 */
import type { Page } from '@playwright/test'

import { AUTH_STORAGE_KEYS } from '../../responsive/fixtures/auth'
import type { ValidatedEditorialActor } from './fixture'

export interface AuthSeedEntry {
  readonly key: string
  readonly value: string
}

export interface AuthSeedPlan {
  readonly set: readonly AuthSeedEntry[]
  readonly remove: readonly string[]
}

/** Keys that must not exist for an access-only actor session. */
export const AUTH_SEED_ABSENT_KEYS: readonly string[] = Object.freeze([AUTH_STORAGE_KEYS.refreshToken, AUTH_STORAGE_KEYS.tempToken])

/** Builds the full seed plan for one validated actor. Pure: no storage access, no token generation. */
export function buildEditorialActorSeedPlan(actor: ValidatedEditorialActor): AuthSeedPlan {
  const set: AuthSeedEntry[] = [
    { key: AUTH_STORAGE_KEYS.accessToken, value: actor.tokens.access },
    { key: AUTH_STORAGE_KEYS.user, value: JSON.stringify(actor.user) },
    { key: AUTH_STORAGE_KEYS.permissionCodes, value: JSON.stringify([...actor.permissionCodes]) },
    {
      key: AUTH_STORAGE_KEYS.memberships,
      value: JSON.stringify(actor.memberships.map(({ id, name, slug }) => ({ id, name, slug }))),
    },
    { key: AUTH_STORAGE_KEYS.isSuperAdmin, value: actor.isSuperAdmin ? 'true' : 'false' },
  ]
  const remove = [...AUTH_SEED_ABSENT_KEYS]
  if (actor.tenant) set.push({ key: AUTH_STORAGE_KEYS.currentTenant, value: JSON.stringify(actor.tenant) })
  else remove.push(AUTH_STORAGE_KEYS.currentTenant)
  return Object.freeze({ set: Object.freeze(set), remove: Object.freeze(remove) })
}

/** Seeds the plan before any app script runs on the page. */
export async function seedEditorialActor(page: Page, actor: ValidatedEditorialActor): Promise<void> {
  await page.addInitScript((plan) => {
    for (const key of plan.remove) window.localStorage.removeItem(key)
    for (const { key, value } of plan.set) window.localStorage.setItem(key, value)
  }, buildEditorialActorSeedPlan(actor))
}
