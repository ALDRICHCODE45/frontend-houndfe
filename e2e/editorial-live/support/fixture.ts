/**
 * Backend-issued editorial-live fixture contract (pure validation, fail-closed).
 * Modeled on `e2e/cash-live/support/fixture.ts`.
 *
 * The fixture JSON is emitted by the local backend session only (fictitious actors with real,
 * backend-issued access-only tokens for a disposable environment). Nothing in this repository may
 * contain a real token, so the file lives under `artifacts/editorial-live/` (realpath-checked at
 * load), tokens are validated for presence/shape only and never echoed (errors carry field paths),
 * refresh tokens/OTP are rejected, and the backend URL/frontend origin must match the declared env.
 *
 * Schema (schemaVersion 1):
 * {
 *   schemaVersion: 1,
 *   backend: { url, basePath, resourceId },
 *   frontendOrigin: 'http://127.0.0.1:4191',
 *   tenants: [{ id, name, slug }],
 *   product: { id, tenantId, name, disposable: true },
 *   actors: {
 *     'superadmin-global': <actor isSuperAdmin=true, tenantId=null, tenant=null>,
 *     'superadmin-tenant': <actor isSuperAdmin=true, tenant = product tenant>,
 *     'manage-all':        <actor isSuperAdmin=false, permissionCodes ∋ manage:all, tenant = product tenant>,
 *     'editorial-only':    <actor isSuperAdmin=false, ∋ read+update:ProductEditorialDraft, ∌ manage:all>
 *   },
 *   metadata: { owner, backendHEAD, resourceId, generatedAt, cleanup, accessOnly: true,
 *               refreshTokenIssued: false, otpIssued: false }
 * }
 * actor = { userId, email, isSuperAdmin, tenantId, tenant, permissionCodes, accessToken,
 *           user: { id, email, name, isActive, createdAt },
 *           memberships: [{ tenantId, tenantName, tenantSlug, roleName }], expiresAt, ttlSeconds }
 */
import fs from 'node:fs'
import path from 'node:path'

import { EDITORIAL_LIVE_SCRATCH_ROOT, isStrictlyInside, resolveFixturePath } from './env'

export class EditorialLiveFixtureError extends Error {}

export interface EditorialLiveFixtureBinding {
  readonly backendUrl: string
  readonly frontendOrigin: string
}

/** The four owned actors, in deterministic journey order. */
export const EDITORIAL_LIVE_ACTOR_ROLES = ['superadmin-global', 'superadmin-tenant', 'manage-all', 'editorial-only'] as const
export type EditorialLiveActorRole = (typeof EDITORIAL_LIVE_ACTOR_ROLES)[number]

export const EDITORIAL_READ = 'read:ProductEditorialDraft'
export const EDITORIAL_UPDATE = 'update:ProductEditorialDraft'
export const MANAGE_ALL = 'manage:all'

export interface FixtureTenant { readonly id: string; readonly name: string; readonly slug: string }
export interface FixtureUser { readonly id: string; readonly email: string; readonly name: string; readonly isActive: boolean; readonly createdAt: string }
export interface FixtureMembership { readonly id: string; readonly name: string; readonly slug: string; readonly roleName: string }

export interface ValidatedEditorialActor {
  readonly role: EditorialLiveActorRole
  readonly userId: string
  readonly email: string
  readonly isSuperAdmin: boolean
  /** `null` only for `superadmin-global`. */
  readonly tenant: FixtureTenant | null
  readonly permissionCodes: readonly string[]
  readonly tokens: { readonly access: string }
  readonly expiresAt: string
  readonly ttlSeconds: number
  readonly user: FixtureUser
  readonly memberships: readonly FixtureMembership[]
}

export interface ValidatedEditorialLiveFixture {
  readonly schemaVersion: 1
  readonly backend: { readonly url: string; readonly basePath: string; readonly resourceId: string }
  readonly frontendOrigin: string
  readonly tenants: readonly FixtureTenant[]
  readonly product: { readonly id: string; readonly tenantId: string; readonly name: string }
  readonly actors: readonly ValidatedEditorialActor[]
  readonly metadata: Readonly<Record<string, unknown>>
}

export interface FixtureIo {
  readonly readFile: (absolutePath: string) => string
  readonly realpath: (absolutePath: string) => string
}

const defaultIo: FixtureIo = {
  readFile: (absolutePath) => fs.readFileSync(absolutePath, 'utf8'),
  realpath: (absolutePath) => fs.realpathSync(absolutePath),
}

const PERMISSION_CODE_PATTERN = /^[a-zA-Z]+:[A-Za-z]+$/
/** Synthetic tokens of the responsive mock harness: never valid here. */
const SYNTHETIC_TOKEN_VALUES = new Set(['e2e-access-token-0001', 'e2e-refresh-token-0001'])

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const isTenantShape = (value: unknown): value is FixtureTenant =>
  isPlainObject(value) && isNonEmptyString(value.id) && isNonEmptyString(value.name) && isNonEmptyString(value.slug)

class Errors {
  readonly messages: string[] = []
  require(condition: unknown, message: string): void {
    if (!condition) this.messages.push(message)
  }
}

function validateActor(input: unknown, role: EditorialLiveActorRole, productTenantId: string | null, tenantIds: readonly string[], errors: Errors): void {
  const label = `actors.${role}`
  if (!isPlainObject(input)) {
    errors.require(false, `${label} must be an object`)
    return
  }
  const actor = input
  const superAdmin = role === 'superadmin-global' || role === 'superadmin-tenant'
  errors.require(actor.isSuperAdmin === superAdmin, `${label}.isSuperAdmin must be ${superAdmin}`)

  const user = actor.user
  errors.require(isPlainObject(user), `${label}.user must match { id, email, name, isActive, createdAt }`)
  if (isPlainObject(user)) {
    errors.require(isNonEmptyString(user.id), `${label}.user.id must be a non-empty string`)
    errors.require(isNonEmptyString(user.email), `${label}.user.email must be a non-empty string`)
    errors.require(isNonEmptyString(user.name), `${label}.user.name must be a non-empty string`)
    errors.require(typeof user.isActive === 'boolean', `${label}.user.isActive must be a boolean`)
    errors.require(isNonEmptyString(user.createdAt), `${label}.user.createdAt must be a non-empty string`)
    errors.require(actor.userId === user.id, `${label}.userId must bind to ${label}.user.id`)
    errors.require(actor.email === user.email, `${label}.email must bind to ${label}.user.email`)
  }
  errors.require(isNonEmptyString(actor.userId), `${label}.userId must be a non-empty string`)

  if (role === 'superadmin-global') {
    errors.require(actor.tenantId === null, `${label}.tenantId must be null (global mode)`)
    errors.require(actor.tenant === null, `${label}.tenant must be null (global mode)`)
  } else {
    errors.require(isTenantShape(actor.tenant), `${label}.tenant must match { id, name, slug }`)
    if (isTenantShape(actor.tenant)) {
      errors.require(actor.tenantId === actor.tenant.id, `${label}.tenantId must bind to ${label}.tenant.id`)
      errors.require(productTenantId !== null && actor.tenant.id === productTenantId, `${label}.tenant.id must be the product tenant (product.tenantId)`)
    }
  }

  const codes = actor.permissionCodes
  errors.require(Array.isArray(codes) && (superAdmin || codes.length > 0),
    `${label}.permissionCodes must be an array of "action:subject" codes${superAdmin ? '' : ' (non-empty)'}`)
  if (Array.isArray(codes)) {
    codes.forEach((code, index) => errors.require(isNonEmptyString(code) && PERMISSION_CODE_PATTERN.test(code),
      `${label}.permissionCodes[${index}] must match the "action:subject" format`))
    if (role === 'manage-all') errors.require(codes.includes(MANAGE_ALL), `${label}.permissionCodes must include ${MANAGE_ALL}`)
    if (role === 'editorial-only') {
      errors.require(codes.includes(EDITORIAL_READ) && codes.includes(EDITORIAL_UPDATE),
        `${label}.permissionCodes must include ${EDITORIAL_READ} and ${EDITORIAL_UPDATE}`)
      errors.require(!codes.includes(MANAGE_ALL), `${label}.permissionCodes must not include ${MANAGE_ALL} (specific grants only)`)
    }
  }

  const token = actor.accessToken
  errors.require(isNonEmptyString(token), `${label}.accessToken must be a backend-issued non-empty string`)
  if (isNonEmptyString(token)) {
    errors.require(!/\s/.test(token), `${label}.accessToken must not contain whitespace`)
    errors.require(!SYNTHETIC_TOKEN_VALUES.has(token), `${label}.accessToken is a synthetic mock-harness placeholder`)
  }
  errors.require(actor.refreshToken === undefined, `${label} must not carry a refresh token (access-only)`)
  errors.require(isNonEmptyString(actor.expiresAt) && !Number.isNaN(Date.parse(actor.expiresAt)), `${label}.expiresAt must be a parseable date`)
  errors.require(typeof actor.ttlSeconds === 'number' && Number.isFinite(actor.ttlSeconds) && actor.ttlSeconds > 0,
    `${label}.ttlSeconds must be a positive finite number`)

  const memberships = actor.memberships
  errors.require(Array.isArray(memberships) && (superAdmin || memberships.length > 0),
    `${label}.memberships must be an array${superAdmin ? '' : ' (non-empty)'}`)
  if (Array.isArray(memberships)) {
    memberships.forEach((membership, index) => {
      const shape = `${label}.memberships[${index}]`
      errors.require(isPlainObject(membership) && isNonEmptyString(membership.tenantId) && isNonEmptyString(membership.tenantName) &&
        isNonEmptyString(membership.tenantSlug) && isNonEmptyString(membership.roleName),
      `${shape} must match { tenantId, tenantName, tenantSlug, roleName }`)
      if (isPlainObject(membership) && isNonEmptyString(membership.tenantId)) {
        errors.require(tenantIds.includes(membership.tenantId), `${shape}.tenantId must be one of the declared tenants[]`)
      }
    })
    if (role !== 'superadmin-global' && isTenantShape(actor.tenant)) {
      const tenantId = actor.tenant.id
      errors.require(superAdmin || memberships.some(m => isPlainObject(m) && m.tenantId === tenantId),
        `${label}.memberships must include the actor tenant`)
    }
  }
}

/** Validates the parsed fixture against the declared ownership binding. Messages carry field paths only. */
export function validateEditorialLiveFixture(input: unknown, expected: EditorialLiveFixtureBinding): ValidatedEditorialLiveFixture {
  if (!isPlainObject(input)) throw new EditorialLiveFixtureError('fixture must be a JSON object')
  const errors = new Errors()
  const candidate = input
  errors.require(candidate.schemaVersion === 1, 'schemaVersion must be 1')

  const backend = candidate.backend
  errors.require(isPlainObject(backend), 'backend must be an object { url, basePath, resourceId }')
  if (isPlainObject(backend)) {
    errors.require(backend.url === expected.backendUrl, 'backend.url must match the declared EDITORIAL_LIVE_BACKEND_URL exactly (ownership binding mismatch)')
    errors.require(typeof backend.basePath === 'string', 'backend.basePath must be a string')
    errors.require(isNonEmptyString(backend.resourceId), 'backend.resourceId must be a non-empty string')
  }
  errors.require(candidate.frontendOrigin === expected.frontendOrigin,
    `frontendOrigin must match the owned frontend origin ${expected.frontendOrigin} (ownership binding mismatch)`)

  const tenants = candidate.tenants
  errors.require(Array.isArray(tenants) && tenants.length > 0 && tenants.every(isTenantShape), 'tenants must be a non-empty array of { id, name, slug }')
  const tenantIds = Array.isArray(tenants) ? tenants.filter(isTenantShape).map(tenant => tenant.id) : []
  errors.require(new Set(tenantIds).size === tenantIds.length, 'tenants must have distinct id values')

  const product = candidate.product
  let productTenantId: string | null = null
  errors.require(isPlainObject(product), 'product must be an object { id, tenantId, name, disposable }')
  if (isPlainObject(product)) {
    errors.require(isNonEmptyString(product.id), 'product.id must be a non-empty string')
    errors.require(isNonEmptyString(product.name), 'product.name must be a non-empty string')
    errors.require(isNonEmptyString(product.tenantId) && tenantIds.includes(product.tenantId), 'product.tenantId must be one of the declared tenants[]')
    // The journey may discard a pre-existing draft: only a declared disposable product is acceptable.
    errors.require(product.disposable === true, 'product.disposable must be true (the journey discards its draft)')
    if (isNonEmptyString(product.tenantId)) productTenantId = product.tenantId
  }

  const actors = candidate.actors
  errors.require(isPlainObject(actors), `actors must be an object keyed by ${EDITORIAL_LIVE_ACTOR_ROLES.join('/')}`)
  if (isPlainObject(actors)) {
    for (const role of EDITORIAL_LIVE_ACTOR_ROLES) {
      if (actors[role] === undefined) errors.require(false, `actors.${role} is required`)
      else validateActor(actors[role], role, productTenantId, tenantIds, errors)
    }
    const present = EDITORIAL_LIVE_ACTOR_ROLES.map(role => actors[role]).filter(isPlainObject)
    const userIds = present.map(actor => actor.userId).filter(isNonEmptyString)
    errors.require(new Set(userIds).size === userIds.length, 'actors must have distinct userId values')
    const tokens = present.map(actor => actor.accessToken).filter(isNonEmptyString)
    errors.require(new Set(tokens).size === tokens.length, 'actors must carry distinct accessToken values')
  }

  const metadata = candidate.metadata
  errors.require(isPlainObject(metadata), 'metadata must be an object')
  if (isPlainObject(metadata)) {
    for (const key of ['owner', 'backendHEAD', 'generatedAt'] as const) {
      errors.require(isNonEmptyString(metadata[key]), `metadata.${key} must be a non-empty string`)
    }
    errors.require(metadata.cleanup !== undefined && metadata.cleanup !== null, 'metadata.cleanup must describe the owned cleanup contract')
    errors.require(metadata.accessOnly === true, 'metadata.accessOnly must be true')
    errors.require(metadata.refreshTokenIssued === false, 'metadata.refreshTokenIssued must be false')
    errors.require(metadata.otpIssued === false, 'metadata.otpIssued must be false')
    errors.require(isPlainObject(backend) && isNonEmptyString(backend.resourceId) && metadata.resourceId === backend.resourceId,
      'metadata.resourceId must bind to backend.resourceId')
  }

  if (errors.messages.length > 0) {
    throw new EditorialLiveFixtureError(`editorial-live fixture rejected:\n${errors.messages.join('\n')}`)
  }

  const backendRecord = backend as Record<string, string>
  const productRecord = product as Record<string, string>
  const actorMap = actors as Record<string, Record<string, unknown>>
  return Object.freeze({
    schemaVersion: 1 as const,
    backend: Object.freeze({ url: backendRecord.url!, basePath: backendRecord.basePath!, resourceId: backendRecord.resourceId! }),
    frontendOrigin: candidate.frontendOrigin as string,
    tenants: Object.freeze((tenants as FixtureTenant[]).map(tenant => Object.freeze({ id: tenant.id, name: tenant.name, slug: tenant.slug }))),
    product: Object.freeze({ id: productRecord.id!, tenantId: productRecord.tenantId!, name: productRecord.name! }),
    actors: Object.freeze(EDITORIAL_LIVE_ACTOR_ROLES.map(role => {
      const actor = actorMap[role]!
      const user = actor.user as FixtureUser
      const tenant = actor.tenant as FixtureTenant | null
      return Object.freeze({
        role,
        userId: actor.userId as string,
        email: actor.email as string,
        isSuperAdmin: actor.isSuperAdmin as boolean,
        tenant: tenant ? Object.freeze({ id: tenant.id, name: tenant.name, slug: tenant.slug }) : null,
        permissionCodes: Object.freeze([...(actor.permissionCodes as string[])]),
        tokens: Object.freeze({ access: actor.accessToken as string }),
        expiresAt: actor.expiresAt as string,
        ttlSeconds: actor.ttlSeconds as number,
        user: Object.freeze({ id: user.id, email: user.email, name: user.name, isActive: user.isActive, createdAt: user.createdAt }),
        memberships: Object.freeze((actor.memberships as Record<string, string>[]).map(m => Object.freeze({
          id: m.tenantId!, name: m.tenantName!, slug: m.tenantSlug!, roleName: m.roleName!,
        }))),
      })
    })),
    metadata: Object.freeze({ ...(metadata as Record<string, unknown>) }),
  })
}

/**
 * Reads and validates the fixture through injectable IO. The declared path is resolved to a real
 * path first so a symlink cannot smuggle a file in from outside the scratch root. Reader/parse
 * errors are rethrown without their underlying message so no file content can leak.
 */
export function loadEditorialLiveFixture(
  declaredPath: string,
  expected: EditorialLiveFixtureBinding,
  projectRoot: string,
  io: FixtureIo = defaultIo,
): ValidatedEditorialLiveFixture {
  let resolved: string
  try {
    resolved = resolveFixturePath(declaredPath, projectRoot)
  } catch (error) {
    throw new EditorialLiveFixtureError((error as Error).message)
  }
  let real: string
  try {
    real = io.realpath(resolved)
  } catch {
    throw new EditorialLiveFixtureError('fixture file at the declared path is not readable (cannot resolve its real path)')
  }
  // Compare real paths on both sides: the file, the scratch root and the project root may each
  // sit behind a symlink. The real file must be inside the real scratch root, which must itself
  // be inside the real project root.
  const scratch = path.resolve(projectRoot, EDITORIAL_LIVE_SCRATCH_ROOT)
  const realOr = (candidate: string): string => {
    try {
      return io.realpath(candidate)
    } catch {
      return candidate
    }
  }
  const realRoot = realOr(path.resolve(projectRoot))
  const realScratch = realOr(scratch)
  if (!isStrictlyInside(realScratch, real) || !isStrictlyInside(realRoot, realScratch)) {
    throw new EditorialLiveFixtureError(`fixture file must resolve inside the reserved scratch root ${EDITORIAL_LIVE_SCRATCH_ROOT}/`)
  }
  let raw: string
  try {
    raw = io.readFile(real)
  } catch {
    throw new EditorialLiveFixtureError('fixture file is not readable (underlying error suppressed so no content can leak)')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new EditorialLiveFixtureError('fixture file is not valid JSON (underlying error suppressed so no content can leak)')
  }
  return validateEditorialLiveFixture(parsed, expected)
}
