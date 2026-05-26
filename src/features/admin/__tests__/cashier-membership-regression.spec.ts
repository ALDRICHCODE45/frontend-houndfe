import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { glob } from 'node:fs/promises'

/**
 * R-FE5-001 regression guard.
 *
 * Cashier-only users have no `read:TenantMembership` permission after
 * backend SDD `tenant-rbac-hardening`. Any screen reachable by a
 * Cashier MUST NOT consume `/admin/tenants/:tenantId/members` nor
 * import from `memberships.api.ts` directly. The legitimate operational
 * endpoint for Cashier surfaces is `/users/assignable`.
 *
 * This test scans POS source files and asserts neither of those
 * forbidden patterns appear. It is a static guard — no runtime
 * mocks involved.
 */

const POS_ROOT = resolve(process.cwd(), 'src/features/POS')

const FORBIDDEN_IMPORT_PATTERNS = [
  /from\s+['"][^'"]*memberships\.api['"]/,
  /from\s+['"][^'"]*tenants\/memberships['"]/,
]

const FORBIDDEN_URL_PATTERNS = [/\/admin\/tenants\/[^'"]+\/members/]

async function listSourceFiles(): Promise<string[]> {
  const files: string[] = []
  for await (const file of glob('**/*.{ts,vue}', {
    cwd: POS_ROOT,
    exclude: (path) => path.includes('__tests__') || path.includes('node_modules'),
  })) {
    files.push(resolve(POS_ROOT, file))
  }
  return files
}

describe('R-FE5-001: Cashier-reachable POS screens do not consume membership admin endpoints', () => {
  it('does not import membership admin APIs anywhere under src/features/POS', async () => {
    const files = await listSourceFiles()
    const offenders: string[] = []

    for (const filePath of files) {
      const content = readFileSync(filePath, 'utf-8')
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        if (pattern.test(content)) {
          offenders.push(`${filePath} — matches ${pattern}`)
        }
      }
    }

    expect(
      offenders,
      `POS files importing membership admin APIs (use /users/assignable instead):\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('does not reference the /admin/tenants/:id/members URL pattern under src/features/POS', async () => {
    const files = await listSourceFiles()
    const offenders: string[] = []

    for (const filePath of files) {
      const content = readFileSync(filePath, 'utf-8')
      for (const pattern of FORBIDDEN_URL_PATTERNS) {
        if (pattern.test(content)) {
          offenders.push(`${filePath} — matches ${pattern}`)
        }
      }
    }

    expect(
      offenders,
      `POS files referencing /admin/tenants/:id/members (Cashier-forbidden):\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('verifies the audit is sourced from a real, non-empty POS tree (sanity)', async () => {
    const files = await listSourceFiles()
    expect(files.length).toBeGreaterThan(0)
  })
})
