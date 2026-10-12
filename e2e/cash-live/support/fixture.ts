/**
 * Backend-issued auth fixture contract (pure validation, fail-closed).
 *
 * The fixture JSON is emitted by the local backend session ONLY (fictitious
 * actors with real, backend-issued access tokens for the disposable local
 * environment). Nothing in this repository may ever contain a real token, so:
 *
 * - the fixture file must live inside the reserved scratch root (enforced by
 *   `resolveFixturePath` in `env.ts` and re-checked against a realpath here);
 * - tokens are validated for PRESENCE and SHAPE only — never generated,
 *   never logged, never echoed in error messages (errors carry field paths);
 * - the access-only contract is enforced: the owned backend issues NO refresh
 *   token and NO OTP, so a fixture declaring them is rejected outright and no
 *   refresh token is ever fabricated by this module;
 * - the synthetic placeholder tokens of the responsive mock harness are
 *   rejected so a mock fixture can never be mistaken for the backend fixture;
 * - the backend URL, frontend origin and resource identity must exactly match
 *   the declared ownership contract, so a fixture from another environment or
 *   resource can never be consumed.
 *
 * Documented schema (schemaVersion 1, the actual backend contract):
 * {
 *   schemaVersion: 1,
 *   backend: { url: string, basePath: string, resourceId: string },
 *   frontendOrigin: 'http://127.0.0.1:4189',
 *   tenants: [{ id, name, slug }],
 *   actors: {                        // exactly the three owned roles
 *     cashier:  <actor>,
 *     verifier: <actor>,
 *     foreign:  <actor>              // denial/isolation actor (no route ability required)
 *   },
 *   metadata: {
 *     owner, backendHEAD, resourceId, generatedAt,
 *     readiness: { seeded, tenants, users, permissionsSeeded, accessTokensIssued },
 *     cleanup, accessOnly: true, refreshTokenIssued: false, otpIssued: false
 *   }
 * }
 * actor = {
 *   userId, tenantId, email, permissionCodes, accessToken, functionalRole,
 *   user: { id, email, name, isActive, createdAt },   // AuthUser shape
 *   tenant: { id, name, slug },                        // TenantSummary shape
 *   memberships: [{ tenantId, tenantName, tenantSlug, roleName }],
 *   expiresAt, ttlSeconds
 * }
 *
 * Normalized output keeps the shape the existing consumers read (actor.user,
 * actor.tenant, actor.permissionCodes, actor.memberships, actor.tokens.access)
 * and drops the provisional array/`binding`/`resourceIdentity` shape. There is
 * deliberately no `refresh` token in the normalized type.
 */
import fs from 'node:fs'
import path from 'node:path'

import { resolveFixturePath } from './env'

export class CashLiveFixtureError extends Error {}

/** Ownership binding declared by the env contract (no new env variables). */
export interface CashLiveFixtureBinding {
  readonly backendUrl: string
  readonly frontendOrigin: string
}

/** The three owned fixture roles, in deterministic normalized order. */
export const CASH_LIVE_ACTOR_ROLES = ['cashier', 'verifier', 'foreign'] as const
export type CashLiveActorRole = (typeof CASH_LIVE_ACTOR_ROLES)[number]

export interface ValidatedFixtureUser {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly isActive: boolean
  readonly createdAt: string
}

export interface ValidatedFixtureTenant {
  readonly id: string
  readonly name: string
  readonly slug: string
}

/** Backend memberships normalized to the app's `TenantSummary` shape plus the role name. */
export interface ValidatedFixtureMembership {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly roleName: string
}

export interface ValidatedFixtureBackend {
  readonly url: string
  readonly basePath: string
  readonly resourceId: string
}

export interface ValidatedFixtureActor {
  readonly role: CashLiveActorRole
  readonly userId: string
  readonly tenantId: string
  readonly email: string
  readonly functionalRole: string
  readonly permissionCodes: readonly string[]
  /** Access-only: the backend issues no refresh token for this fixture. */
  readonly tokens: { readonly access: string }
  readonly expiresAt: string
  readonly ttlSeconds: number
  readonly user: ValidatedFixtureUser
  readonly tenant: ValidatedFixtureTenant
  readonly memberships: readonly ValidatedFixtureMembership[]
}

export interface ValidatedCashLiveFixture {
  readonly schemaVersion: 1
  readonly backend: ValidatedFixtureBackend
  readonly frontendOrigin: string
  readonly tenants: readonly ValidatedFixtureTenant[]
  readonly actors: readonly ValidatedFixtureActor[]
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
/** Synthetic tokens of the responsive MOCK harness — never valid for the live journey. */
const SYNTHETIC_TOKEN_VALUES = new Set(['e2e-access-token-0001', 'e2e-refresh-token-0001'])
/**
 * Role-level capability required for the role to be meaningful in the running
 * journey. The cashier is the EXECUTING actor and must pass the `/pos/caja`
 * route guard (`read:CashRegister`). The verifier is deliberately NOT
 * constrained here: the owned backend issues it only the minimal cash
 * verification/handover set with no catalog/open ability, and the
 * operation-specific permissions of any journey that later runs as the
 * verifier belong to that journey's preflight. The foreign actor is the
 * denial/isolation actor and is constrained by its journey, not here.
 */
const ROLE_REQUIRED_PERMISSIONS: Readonly<Partial<Record<CashLiveActorRole, readonly string[]>>> = {
  cashier: ['read:CashRegister'],
}
/** Documented readiness counters of the backend seed. */
const READINESS_KEYS = [
  'seeded',
  'tenants',
  'users',
  'permissionsSeeded',
  'accessTokensIssued',
] as const

class FixtureErrors {
  readonly messages: string[] = []
  add(message: string): void {
    this.messages.push(message)
  }
  require(condition: unknown, message: string): void {
    if (!condition) this.add(message)
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isTenantShape = (value: unknown): value is ValidatedFixtureTenant =>
  isPlainObject(value) &&
  isNonEmptyString(value.id) &&
  isNonEmptyString(value.name) &&
  isNonEmptyString(value.slug)

function validateActor(
  input: unknown,
  role: CashLiveActorRole,
  tenants: readonly ValidatedFixtureTenant[] | null,
  errors: FixtureErrors,
): void {
  const label = `actors.${role}`
  if (!isPlainObject(input)) {
    errors.add(`${label} must be an object`)
    return
  }
  const actor = input

  const userId = actor.userId
  const tenantId = actor.tenantId
  const email = actor.email

  const user = actor.user
  errors.require(
    isPlainObject(user),
    `${label}.user must match the AuthUser shape { id, email, name, isActive, createdAt }`,
  )
  if (isPlainObject(user)) {
    errors.require(isNonEmptyString(user.id), `${label}.user.id must be a non-empty string`)
    errors.require(isNonEmptyString(user.email), `${label}.user.email must be a non-empty string`)
    errors.require(isNonEmptyString(user.name), `${label}.user.name must be a non-empty string`)
    errors.require(typeof user.isActive === 'boolean', `${label}.user.isActive must be a boolean`)
    errors.require(
      isNonEmptyString(user.createdAt),
      `${label}.user.createdAt must be a non-empty string`,
    )
    errors.require(
      userId === user.id,
      `${label}.userId must bind to ${label}.user.id (internal identity binding)`,
    )
    errors.require(
      email === user.email,
      `${label}.email must bind to ${label}.user.email (internal identity binding)`,
    )
  }

  const tenant = actor.tenant
  errors.require(
    isTenantShape(tenant),
    `${label}.tenant must match the TenantSummary shape { id, name, slug }`,
  )
  if (isTenantShape(tenant)) {
    errors.require(
      tenantId === tenant.id,
      `${label}.tenantId must bind to ${label}.tenant.id (internal identity binding)`,
    )
    if (tenants) {
      errors.require(
        tenants.some((candidate) => candidate.id === tenant.id),
        `${label}.tenant.id must be one of the declared tenants[]`,
      )
    }
  }

  errors.require(isNonEmptyString(userId), `${label}.userId must be a non-empty string`)
  errors.require(isNonEmptyString(tenantId), `${label}.tenantId must be a non-empty string`)
  errors.require(isNonEmptyString(email), `${label}.email must be a non-empty string`)
  errors.require(
    isNonEmptyString(actor.functionalRole),
    `${label}.functionalRole must be a non-empty string`,
  )

  const permissions = actor.permissionCodes
  errors.require(
    Array.isArray(permissions) && permissions.length > 0,
    `${label}.permissionCodes must be a non-empty array of "action:subject" codes`,
  )
  if (Array.isArray(permissions)) {
    permissions.forEach((code, index) => {
      errors.require(
        isNonEmptyString(code) && PERMISSION_CODE_PATTERN.test(code),
        `${label}.permissionCodes[${index}] must match the "action:subject" format`,
      )
    })
    const required = ROLE_REQUIRED_PERMISSIONS[role]
    if (required) {
      for (const code of required) {
        errors.require(
          permissions.includes(code),
          `${label}.permissionCodes must include ${code} (required by the /pos/caja route guard)`,
        )
      }
    }
  }

  const accessToken = actor.accessToken
  errors.require(
    isNonEmptyString(accessToken),
    `${label}.accessToken must be a backend-issued non-empty string`,
  )
  if (isNonEmptyString(accessToken)) {
    errors.require(!/\s/.test(accessToken), `${label}.accessToken must not contain whitespace`)
    errors.require(
      !SYNTHETIC_TOKEN_VALUES.has(accessToken),
      `${label}.accessToken is a synthetic mock-harness placeholder value and must never be used for the live journey`,
    )
  }
  errors.require(
    actor.refreshToken === undefined,
    `${label} must not carry a refresh token: the owned backend issues access-only tokens`,
  )

  const expiresAt = actor.expiresAt
  errors.require(
    isNonEmptyString(expiresAt),
    `${label}.expiresAt must be a non-empty timestamp string`,
  )
  if (isNonEmptyString(expiresAt)) {
    errors.require(
      !Number.isNaN(Date.parse(expiresAt)),
      `${label}.expiresAt must be a parseable date`,
    )
  }
  errors.require(
    typeof actor.ttlSeconds === 'number' &&
      Number.isFinite(actor.ttlSeconds) &&
      actor.ttlSeconds > 0,
    `${label}.ttlSeconds must be a positive finite number`,
  )

  const memberships = actor.memberships
  errors.require(
    Array.isArray(memberships) && memberships.length > 0,
    `${label}.memberships must be a non-empty array`,
  )
  if (Array.isArray(memberships)) {
    memberships.forEach((membership, index) => {
      const shape = `${label}.memberships[${index}]`
      if (!isPlainObject(membership)) {
        errors.add(`${shape} must match { tenantId, tenantName, tenantSlug, roleName }`)
        return
      }
      errors.require(
        isNonEmptyString(membership.tenantId),
        `${shape}.tenantId must be a non-empty string`,
      )
      errors.require(
        isNonEmptyString(membership.tenantName),
        `${shape}.tenantName must be a non-empty string`,
      )
      errors.require(
        isNonEmptyString(membership.tenantSlug),
        `${shape}.tenantSlug must be a non-empty string`,
      )
      errors.require(
        isNonEmptyString(membership.roleName),
        `${shape}.roleName must be a non-empty string`,
      )
      if (tenants && isNonEmptyString(membership.tenantId)) {
        errors.require(
          tenants.some((candidate) => candidate.id === membership.tenantId),
          `${shape}.tenantId must be one of the declared tenants[]`,
        )
      }
    })
    if (isNonEmptyString(tenantId)) {
      errors.require(
        memberships.some(
          (membership) => isPlainObject(membership) && membership.tenantId === tenantId,
        ),
        `${label}.memberships must include the actor tenant ${label}.tenantId`,
      )
    }
  }
}

/**
 * Validates the raw parsed fixture against the declared ownership binding.
 * Error messages carry field paths only — token values never appear anywhere.
 */
export function validateCashLiveFixture(
  input: unknown,
  expected: CashLiveFixtureBinding,
): ValidatedCashLiveFixture {
  const errors = new FixtureErrors()
  if (!isPlainObject(input)) {
    throw new CashLiveFixtureError('fixture must be a JSON object')
  }
  const candidate = input

  errors.require(candidate.schemaVersion === 1, 'schemaVersion must be 1')

  const backend = candidate.backend
  errors.require(isPlainObject(backend), 'backend must be an object { url, basePath, resourceId }')
  if (isPlainObject(backend)) {
    if (backend.url !== expected.backendUrl) {
      errors.add(
        'backend.url must match the declared CASH_LIVE_BACKEND_URL exactly (ownership binding mismatch)',
      )
    }
    errors.require(
      typeof backend.basePath === 'string',
      'backend.basePath must be a string (empty when the backend has no base path)',
    )
    errors.require(
      isNonEmptyString(backend.resourceId),
      'backend.resourceId must be a non-empty string',
    )
  }

  if (candidate.frontendOrigin !== expected.frontendOrigin) {
    errors.add(
      `frontendOrigin must match the owned frontend origin ${expected.frontendOrigin} (ownership binding mismatch)`,
    )
  }

  const tenants = candidate.tenants
  errors.require(Array.isArray(tenants) && tenants.length > 0, 'tenants must be a non-empty array')
  let validatedTenants: readonly ValidatedFixtureTenant[] | null = null
  if (Array.isArray(tenants)) {
    tenants.forEach((tenant, index) => {
      errors.require(isTenantShape(tenant), `tenants[${index}] must match { id, name, slug }`)
    })
    if (tenants.every((tenant) => isTenantShape(tenant))) {
      const declared = tenants as ValidatedFixtureTenant[]
      validatedTenants = declared
      const ids = declared.map((tenant) => tenant.id)
      errors.require(new Set(ids).size === ids.length, 'tenants must have distinct id values')
    }
  }

  const actors = candidate.actors
  errors.require(
    isPlainObject(actors),
    'actors must be an object keyed by the owned roles cashier/verifier/foreign',
  )
  if (isPlainObject(actors)) {
    for (const role of CASH_LIVE_ACTOR_ROLES) {
      if (actors[role] === undefined) {
        errors.add(`actors.${role} is required`)
        continue
      }
      validateActor(actors[role], role, validatedTenants, errors)
    }

    const present = CASH_LIVE_ACTOR_ROLES.map((role) => actors[role]).filter(isPlainObject)
    const userIds = present.map((actor) => actor.userId).filter(isNonEmptyString)
    errors.require(
      new Set(userIds).size === userIds.length,
      'actors must have distinct userId values (one identity per owned role)',
    )
    const accessTokens = present.map((actor) => actor.accessToken).filter(isNonEmptyString)
    errors.require(
      new Set(accessTokens).size === accessTokens.length,
      'actors must carry distinct accessToken values',
    )
  }

  const metadata = candidate.metadata
  errors.require(isPlainObject(metadata), 'metadata must be an object')
  if (isPlainObject(metadata)) {
    errors.require(isNonEmptyString(metadata.owner), 'metadata.owner must be a non-empty string')
    errors.require(
      isNonEmptyString(metadata.backendHEAD),
      'metadata.backendHEAD must be a non-empty string',
    )
    errors.require(
      isNonEmptyString(metadata.generatedAt),
      'metadata.generatedAt must be a non-empty string',
    )
    errors.require(
      metadata.cleanup !== undefined && metadata.cleanup !== null,
      'metadata.cleanup must describe the owned cleanup contract',
    )
    errors.require(
      metadata.accessOnly === true,
      'metadata.accessOnly must be true (the owned backend issues access-only tokens)',
    )
    errors.require(
      metadata.refreshTokenIssued === false,
      'metadata.refreshTokenIssued must be false: no refresh token exists for this fixture',
    )
    errors.require(
      metadata.otpIssued === false,
      'metadata.otpIssued must be false: no OTP was issued for this fixture',
    )
    if (isPlainObject(backend) && isNonEmptyString(backend.resourceId)) {
      errors.require(
        metadata.resourceId === backend.resourceId,
        'metadata.resourceId must bind to backend.resourceId (internal resource identity binding)',
      )
    } else {
      errors.require(
        isNonEmptyString(metadata.resourceId),
        'metadata.resourceId must be a non-empty string',
      )
    }

    const readiness = metadata.readiness
    errors.require(
      isPlainObject(readiness),
      'metadata.readiness must be named by { seeded, tenants, users, permissionsSeeded, accessTokensIssued }',
    )
    if (isPlainObject(readiness)) {
      for (const key of READINESS_KEYS) {
        const value = readiness[key]
        errors.require(
          typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)),
          `metadata.readiness.${key} must be a boolean or a finite number`,
        )
      }
    }
  }

  if (errors.messages.length > 0) {
    throw new CashLiveFixtureError(`cash-live fixture rejected:\n${errors.messages.join('\n')}`)
  }

  // Nothing below can run unless every checked field is present and well-typed.
  const backendRecord = backend as Record<string, unknown>
  const metadataRecord = metadata as Record<string, unknown>
  const actorMap = actors as Record<string, Record<string, unknown>>
  const tenantList = tenants as ValidatedFixtureTenant[]

  return Object.freeze({
    schemaVersion: 1 as const,
    backend: Object.freeze({
      url: backendRecord.url as string,
      basePath: backendRecord.basePath as string,
      resourceId: backendRecord.resourceId as string,
    }),
    frontendOrigin: candidate.frontendOrigin as string,
    tenants: Object.freeze(tenantList.map((tenant) => Object.freeze({ ...tenant }))),
    actors: Object.freeze(
      CASH_LIVE_ACTOR_ROLES.map((role) => {
        const actor = actorMap[role]!
        return Object.freeze({
          role,
          userId: actor.userId as string,
          tenantId: actor.tenantId as string,
          email: actor.email as string,
          functionalRole: actor.functionalRole as string,
          permissionCodes: Object.freeze([...(actor.permissionCodes as string[])]),
          // Access-only mapping: the raw `accessToken` field, never a refresh token.
          tokens: Object.freeze({ access: actor.accessToken as string }),
          expiresAt: actor.expiresAt as string,
          ttlSeconds: actor.ttlSeconds as number,
          user: Object.freeze({ ...(actor.user as object) }) as ValidatedFixtureUser,
          tenant: Object.freeze({ ...(actor.tenant as object) }) as ValidatedFixtureTenant,
          memberships: Object.freeze(
            (actor.memberships as unknown[]).map((membership) => {
              const record = membership as Record<string, unknown>
              return Object.freeze({
                id: record.tenantId as string,
                name: record.tenantName as string,
                slug: record.tenantSlug as string,
                roleName: record.roleName as string,
              })
            }),
          ) as readonly ValidatedFixtureMembership[],
        })
      }),
    ),
    metadata: Object.freeze({ ...metadataRecord }),
  })
}

/**
 * Pure load-time path confinement: a symlink-resolved fixture path that
 * escapes the project root is rejected before any read happens.
 */
export function assertPathInside(projectRoot: string, absolutePath: string): void {
  const rel = path.relative(path.resolve(projectRoot), path.resolve(absolutePath))
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new CashLiveFixtureError(
      `fixture path must resolve inside the project root (${path.resolve(projectRoot)})`,
    )
  }
}

/**
 * Reads and validates the fixture through injectable IO. The declared path is
 * resolved to a real path first so a symlink cannot smuggle a file in from
 * outside the project scratch root. Reader errors are rethrown WITHOUT the
 * underlying message so no file content can leak through error text.
 */
export function loadCashLiveFixture(
  declaredPath: string,
  expected: CashLiveFixtureBinding,
  projectRoot: string,
  io: FixtureIo = defaultIo,
): ValidatedCashLiveFixture {
  let resolved: string
  try {
    resolved = resolveFixturePath(declaredPath, projectRoot)
  } catch (error) {
    throw new CashLiveFixtureError((error as Error).message)
  }

  let real: string
  try {
    real = io.realpath(resolved)
  } catch {
    throw new CashLiveFixtureError(
      `fixture file at the declared path is not readable (cannot resolve its real path)`,
    )
  }
  // Scratch-root confinement first: it is the stricter, most specific rule
  // (a path can escape the scratch root while staying inside the project).
  const scratchRoot = path.resolve(projectRoot, 'artifacts/cash-live')
  const rel = path.relative(scratchRoot, path.resolve(real))
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new CashLiveFixtureError(
      'fixture file must resolve inside the reserved scratch root artifacts/cash-live/',
    )
  }
  assertPathInside(projectRoot, real)

  let raw: string
  try {
    raw = io.readFile(resolved)
  } catch {
    throw new CashLiveFixtureError(
      'fixture file is not readable (underlying error suppressed so no content can leak)',
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new CashLiveFixtureError(
      'fixture file is not valid JSON (failed to parse; underlying error suppressed so no content can leak)',
    )
  }

  return validateCashLiveFixture(parsed, expected)
}
