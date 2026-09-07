/** Deterministic synthetic auth session seed using the exact `src/features/auth/services/auth-storage.ts` localStorage contract. */
import type { Page } from '@playwright/test'

export const AUTH_STORAGE_KEYS = Object.freeze({
  accessToken: 'hound.auth.accessToken', refreshToken: 'hound.auth.refreshToken', user: 'hound.auth.user',
  permissionCodes: 'hound.auth.permissionCodes', currentTenant: 'hound.auth.currentTenant',
  memberships: 'hound.auth.memberships', isSuperAdmin: 'hound.auth.isSuperAdmin', tempToken: 'hound.auth.tempToken',
})

/** Synthetic permission codes use the app's `action:subject` format. */
export const SESSION_PERMISSION_CODES: readonly string[] = Object.freeze(['read:Product', 'update:Product', 'read:Sale', 'read:NotificationConfig', 'update:NotificationConfig'])
export const LIMITED_PERMISSION_CODES: readonly string[] = Object.freeze(['read:Product'])

const SESSION_TENANT = Object.freeze({ id: 'e2e-tenant-0001', name: 'Tienda E2E Centro', slug: 'e2e-centro' })
const SESSION_USER = Object.freeze({ id: 'e2e-user-0001', email: 'e2e.session@hound.test', name: 'Sesión E2E', isActive: true, createdAt: '2025-01-02T03:04:05.000Z' })

export interface AuthSeedEntry { readonly key: string; readonly value: string }
export interface AuthSeedOptions { readonly permissions?: readonly string[]; readonly accessToken?: string }

/** Full tenant-scoped session; `tempToken` is intentionally unset (not applicable once a tenant context exists). */
export function buildAuthSeed(options: AuthSeedOptions = {}): readonly AuthSeedEntry[] {
  return Object.freeze([
    { key: AUTH_STORAGE_KEYS.accessToken, value: options.accessToken ?? 'e2e-access-token-0001' },
    { key: AUTH_STORAGE_KEYS.refreshToken, value: 'e2e-refresh-token-0001' },
    { key: AUTH_STORAGE_KEYS.user, value: JSON.stringify(SESSION_USER) },
    { key: AUTH_STORAGE_KEYS.permissionCodes, value: JSON.stringify(options.permissions ?? SESSION_PERMISSION_CODES) },
    { key: AUTH_STORAGE_KEYS.currentTenant, value: JSON.stringify(SESSION_TENANT) },
    { key: AUTH_STORAGE_KEYS.memberships, value: JSON.stringify([SESSION_TENANT]) },
    { key: AUTH_STORAGE_KEYS.isSuperAdmin, value: 'false' },
  ])
}

/** Seeds the full auth localStorage contract before any app script runs on the page. */
export async function seedAuthSession(page: Page, options: AuthSeedOptions = {}): Promise<void> {
  await page.addInitScript((seed) => { for (const { key, value } of seed) window.localStorage.setItem(key, value) }, buildAuthSeed(options))
}
