/**
 * editorial-live: the admin/global draft cycle against the real local backend
 * (odd/tasks/backlog-closeout.md T3/S1 → T12 of odd/tasks/editorial-single-contract.md, S62–S64/S66).
 *
 * One test per fixture actor, in order: superadmin-global, superadmin-tenant, manage-all,
 * editorial-only. Each opens /pos/products/:id/editorial for the fixture product → initializes the
 * draft when there is none → edits the commercial title → saves (PUT) → discards. NEVER publishes.
 *
 * Asserted: HTTP statuses of every editorial step, the UI state after each step, the route stays
 * on the editorial page (no /select-tenant or /403), no tenant header/query/body key in any
 * backend request, no publication request, and no request to a third-party origin.
 *
 * Safety (cash-live pattern): the fixture is read at RUN time, never at import, so `--list` cannot
 * read it; the per-actor context is hardened and closed in `finally`; evidence is the redacted
 * collector written under artifacts/editorial-live/<runId>/; failures surface as generic errors.
 */
import { expect, test, type Page, type Response } from '@playwright/test'

import { createEvidenceCollector, type EvidenceCollector, type EvidenceKind } from '../../cash-live/support/evidence'
import { resolveEditorialLiveEnv, type ResolvedEditorialLiveEnv } from '../support/env'
import { writeEvidence } from '../support/evidence-writer'
import {
  EDITORIAL_LIVE_ACTOR_ROLES,
  loadEditorialLiveFixture,
  type EditorialLiveActorRole,
  type ValidatedEditorialActor,
  type ValidatedEditorialLiveFixture,
} from '../support/fixture'
import { openLiveEditorialContext, type LiveEditorialContext } from '../support/live-context'

/**
 * OWNERSHIP PIN — fill from the backend «ready» line before the first run. Until then every
 * test fails in the preflight, before any browser or mutation.
 */
const PIN_PENDING = 'PENDING-BACKEND-READY-LINE'
const EXPECTED_BACKEND_BASE_URL: string = PIN_PENDING // e.g. 'http://127.0.0.1:44xxx' (with base path, no trailing slash)
const EXPECTED_RESOURCE_ID: string = PIN_PENDING

const UI_TIMEOUT = 30_000
const NAV_TIMEOUT = 60_000

class EditorialLiveJourneyError extends Error {}

let env: ResolvedEditorialLiveEnv
let fixture: ValidatedEditorialLiveFixture
let collector: EvidenceCollector

function preflight(): void {
  if (EXPECTED_BACKEND_BASE_URL === PIN_PENDING || EXPECTED_RESOURCE_ID === PIN_PENDING) {
    throw new EditorialLiveJourneyError('ownership pin not filled: set EXPECTED_BACKEND_BASE_URL and EXPECTED_RESOURCE_ID from the backend ready line')
  }
  expect(env.backendBaseUrl).toBe(EXPECTED_BACKEND_BASE_URL)
  expect(fixture.backend.url).toBe(EXPECTED_BACKEND_BASE_URL)
  expect(fixture.backend.resourceId).toBe(EXPECTED_RESOURCE_ID)
  expect(fixture.metadata.resourceId).toBe(EXPECTED_RESOURCE_ID)
  expect(fixture.frontendOrigin).toBe(env.frontendOrigin)
  const now = Date.now()
  for (const actor of fixture.actors) expect(Date.parse(actor.expiresAt)).toBeGreaterThan(now)
}

function actorOf(role: EditorialLiveActorRole): ValidatedEditorialActor {
  const actor = fixture.actors.find(candidate => candidate.role === role)
  if (!actor) throw new EditorialLiveJourneyError(`fixture is missing the ${role} actor`)
  return actor
}

const editorialUrl = (suffix = '') => `${env.backendBaseUrl}/products/${encodeURIComponent(fixture.product.id)}/editorial${suffix}`

/** Waits for one backend response of `method` on exactly `url` (query ignored). */
function waitForBackend(page: Page, method: string, url: string): Promise<Response> {
  return page.waitForResponse(response => response.request().method() === method && response.url().split('?')[0] === url, { timeout: UI_TIMEOUT })
}

test.describe.serial('editorial-live admin draft cycle (no publish)', () => {
  test.beforeAll(() => {
    env = resolveEditorialLiveEnv(process.env)
    fixture = loadEditorialLiveFixture(env.fixturePath, { backendUrl: env.backendBaseUrl, frontendOrigin: env.frontendOrigin }, process.cwd())
    collector = createEvidenceCollector(env.runId, fixture.actors.map(actor => actor.tokens.access))
  })

  test.afterAll(() => {
    if (!collector) return
    const records = collector.records()
    console.log(`[editorial-live evidence] ${JSON.stringify(records)}`)
    writeEvidence(env.runArtifactDir, { schemaVersion: 1, runId: env.runId, resourceId: fixture.backend.resourceId, records },
      fixture.actors.map(actor => actor.tokens.access), process.cwd())
  })

  for (const role of EDITORIAL_LIVE_ACTOR_ROLES) {
    test(`${role}: open → initialize → edit → save → discard`, async ({ browser }) => {
      test.setTimeout(180_000)
      const global = role === 'superadmin-global'
      let live: LiveEditorialContext | undefined
      let step: { name: string; kind: EvidenceKind } = { name: `${role}:preflight`, kind: 'ui' }
      const record = (name: string, kind: EvidenceKind, summary: string) => collector.collect(`${role}:${name}`, kind, 'pass', summary)
      try {
        preflight()
        const actor = actorOf(role)
        record('preflight', 'ui', `pinned resource, unexpired token, ${global ? 'global mode (no tenant)' : 'product tenant'}`)

        live = await openLiveEditorialContext(browser, env, actor)
        const page = live.page

        // 1. Open the editorial route: the guard admits the actor and the title lookup succeeds.
        step = { name: `${role}:open`, kind: 'http' }
        const productRead = waitForBackend(page, 'GET', `${env.backendBaseUrl}/products/${encodeURIComponent(fixture.product.id)}`)
        const stateRead = waitForBackend(page, 'GET', editorialUrl())
        await page.goto(`/pos/products/${encodeURIComponent(fixture.product.id)}/editorial`, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT })
        expect((await productRead).status()).toBe(200)
        expect((await stateRead).status()).toBe(200)
        await expect(page).toHaveURL(new RegExp(`/pos/products/${encodeURIComponent(fixture.product.id)}/editorial$`))
        await expect(page.locator('#guided-editorial-title')).toHaveText(fixture.product.name, { timeout: UI_TIMEOUT })
        await expect(page.locator('button.guided-back')).toHaveAttribute('aria-label', global ? 'Volver a sucursales' : 'Volver al producto')
        record('open', 'http', 'GET /products/:id -> 200; GET /products/:id/editorial -> 200; route kept')

        // 2. Initialize when there is no draft yet.
        step = { name: `${role}:initialize`, kind: 'http' }
        const initialize = page.getByTestId('initialize')
        const title = page.locator('#editorial-title')
        await expect(initialize.or(title)).toBeVisible({ timeout: UI_TIMEOUT })
        if (await initialize.isVisible()) {
          const [response] = await Promise.all([waitForBackend(page, 'POST', editorialUrl('/draft/initialize')), initialize.click()])
          expect(response.status()).toBe(201)
          record('initialize', 'http', 'POST /products/:id/editorial/draft/initialize -> 201')
        } else {
          record('initialize', 'ui', 'draft already present (disposable product); initialize not needed')
        }
        await expect(title).toBeEditable({ timeout: UI_TIMEOUT })

        // 3. Edit one field and save it; the follow-up GET shows the saved value.
        step = { name: `${role}:save`, kind: 'http' }
        const value = `Editorial live ${role} ${Date.now()}`
        await title.fill(value)
        const saveBar = page.getByTestId('editorial-save-bar')
        const [saved] = await Promise.all([
          waitForBackend(page, 'PUT', editorialUrl('/draft')),
          saveBar.getByRole('button', { name: 'Guardar', exact: true }).click(),
        ])
        expect(saved.status()).toBe(200)
        await expect(saveBar.locator('.hf-save-bar__status')).toHaveText(/Guardado/, { timeout: UI_TIMEOUT })
        await expect(title).toHaveValue(value)
        record('save', 'http', 'PUT /products/:id/editorial/draft -> 200; UI «Guardado», value kept after re-read')

        // 4. Discard behind its confirmation; the empty draft offers «initialize» again.
        step = { name: `${role}:discard`, kind: 'http' }
        await page.getByTestId('discard-draft').click()
        const dialog = page.getByRole('dialog')
        await expect(dialog).toContainText('¿Descartar el borrador?')
        const [discarded] = await Promise.all([
          waitForBackend(page, 'POST', editorialUrl('/draft/discard')),
          dialog.getByRole('button', { name: 'Descartar borrador', exact: true }).click(),
        ])
        expect(discarded.status()).toBe(200)
        await expect(initialize).toBeVisible({ timeout: UI_TIMEOUT })
        await expect(title).toHaveCount(0)
        record('discard', 'http', 'POST /products/:id/editorial/draft/discard -> 200; UI back to «initialize»')

        // 5. Network boundaries: no tenant override, no publication, no third-party origin, no failure.
        step = { name: `${role}:network`, kind: 'http' }
        await live.audit.dispose()
        expect(live.audit.tenantViolations()).toEqual([])
        expect(live.audit.publicationAttempts()).toEqual([])
        const failed = live.audit.exchanges().filter(exchange => exchange.status !== null && exchange.status >= 400)
        expect(failed.map(exchange => `${exchange.method} ${exchange.path} -> ${exchange.status}`)).toEqual([])
        expect(live.guard.violations()).toEqual([])
        record('network', 'http', `${live.audit.exchanges().length} backend requests; no tenant header/param/body key; no publish; no third-party origin`)
      } catch (error) {
        const message = error instanceof EditorialLiveJourneyError
          ? error.message
          : `step "${step.name}" failed; the underlying error was suppressed so no credential can leak`
        try {
          collector.collect(step.name, step.kind, 'fail', message)
        } catch {
          // Evidence must never mask the journey failure.
        }
        throw new EditorialLiveJourneyError(message)
      } finally {
        await live?.close().catch(() => undefined)
      }
    })
  }
})
