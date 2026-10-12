/**
 * Actor auth seeding for the cash-live journey.
 *
 * Reproduces the EXISTING `hound.auth.*` localStorage contract by reusing the
 * frozen key set from `e2e/responsive/fixtures/auth.ts` (read-only import —
 * that helper is unchanged). Token and identity VALUES come only from the
 * backend-issued validated fixture actor: nothing is invented here and nothing
 * is logged.
 *
 * Access-only contract: the owned backend issues NO refresh token and NO OTP,
 * so this seed never writes `hound.auth.refreshToken` and never writes
 * `hound.auth.tempToken` (not applicable once a tenant context exists). An
 * isolated context seeds the actor AND explicitly clears those absent keys so
 * a reused/contaminated context can never carry a stale credential.
 */
import type { Browser, BrowserContext, Page } from '@playwright/test'

import { AUTH_STORAGE_KEYS } from '../../responsive/fixtures/auth'
import type {
  ValidatedCashLiveFixture,
  ValidatedFixtureActor,
  ValidatedFixtureMembership,
} from './fixture'

export interface AuthSeedEntry {
  readonly key: string
  readonly value: string
}

/**
 * Keys that MUST NOT exist for a live access-only actor session.
 * - `refreshToken`: the owned backend issues access-only tokens.
 * - `tempToken`: not applicable once a tenant context exists.
 */
export const AUTH_SEED_ABSENT_KEYS: readonly string[] = Object.freeze([
  AUTH_STORAGE_KEYS.refreshToken,
  AUTH_STORAGE_KEYS.tempToken,
])

/** What one isolated context must write and which absent keys it must clear. */
export interface AuthSeedPlan {
  readonly set: readonly AuthSeedEntry[]
  readonly remove: readonly string[]
}

/** Memberships use the app's `TenantSummary` shape; `roleName` is fixture-only. */
const toTenantSummary = (membership: ValidatedFixtureMembership) => ({
  id: membership.id,
  name: membership.name,
  slug: membership.slug,
})

/**
 * Builds the full auth seed plan for one validated backend-issued actor.
 * Pure: no `window`/localStorage access, no token generation. `isSuperAdmin`
 * is the deterministic non-super-admin default for the owned cash actors (the
 * access token is never decoded or rewritten here).
 */
export function buildActorAuthSeedPlan(actor: ValidatedFixtureActor): AuthSeedPlan {
  return Object.freeze({
    remove: AUTH_SEED_ABSENT_KEYS,
    set: Object.freeze([
      { key: AUTH_STORAGE_KEYS.accessToken, value: actor.tokens.access },
      { key: AUTH_STORAGE_KEYS.user, value: JSON.stringify(actor.user) },
      { key: AUTH_STORAGE_KEYS.permissionCodes, value: JSON.stringify([...actor.permissionCodes]) },
      { key: AUTH_STORAGE_KEYS.currentTenant, value: JSON.stringify(actor.tenant) },
      {
        key: AUTH_STORAGE_KEYS.memberships,
        value: JSON.stringify(actor.memberships.map(toTenantSummary)),
      },
      { key: AUTH_STORAGE_KEYS.isSuperAdmin, value: 'false' },
    ]),
  })
}

/** The write entries of the plan (the seed payload itself). */
export function buildActorAuthSeed(actor: ValidatedFixtureActor): readonly AuthSeedEntry[] {
  return buildActorAuthSeedPlan(actor).set
}

/** Deterministic permission source for journey assertions (never re-derived). */
export function actorPermissions(actor: ValidatedFixtureActor): readonly string[] {
  return actor.permissionCodes
}

function actorById(fixture: ValidatedCashLiveFixture, userId: string): ValidatedFixtureActor {
  const actor = fixture.actors.find((candidate) => candidate.user.id === userId)
  if (!actor) {
    throw new Error(`fixture has no actor with user.id "${userId}"`)
  }
  return actor
}

/**
 * Seeds the auth localStorage contract before any app script runs on the page,
 * clearing the keys that must be absent for an access-only session.
 */
export async function seedActor(page: Page, actor: ValidatedFixtureActor): Promise<void> {
  await page.addInitScript((plan) => {
    for (const key of plan.remove) window.localStorage.removeItem(key)
    for (const { key, value } of plan.set) window.localStorage.setItem(key, value)
  }, buildActorAuthSeedPlan(actor))
}

/**
 * Opens a dedicated browser context for one fixture actor (cashier / verifier /
 * foreign), seeding the backend-issued auth before any navigation. The caller
 * owns closing the returned context.
 */
export async function openActorContext(
  browser: Browser,
  fixture: ValidatedCashLiveFixture,
  userId: string,
): Promise<{ context: BrowserContext; page: Page; actor: ValidatedFixtureActor }> {
  const actor = actorById(fixture, userId)
  const context = await browser.newContext()
  const page = await context.newPage()
  await seedActor(page, actor)
  return { context, page, actor }
}
