import { test, expect, RESPONSIVE_ORIGIN } from '../fixtures/test'
import { seedAuthSession } from '../fixtures/auth'
import { HY04_NOTIFICATIONS } from '../targets/hy04-notifications'
import { ASSERTION_EVIDENCE_RULES, RESPONSIVE_VIEWPORTS, type ViewportCase } from '../targets/types'
import { assertBoxesWithinOwner, assertDocumentNoHorizontalOverflow, assertExactViewport, assertOverflowContract } from '../assertions/geometry'
import { assertMinimumTargets, assertNamedControls } from '../assertions/accessibility'
import type { ResponsiveEvidenceRecord } from '../evidence/schema'

const HY_STATES = ['loading', 'success', 'error-5xx'] as const
const config = { enabled: true, recipients: ['e2e-user-1'], enabledActions: ['LOW_STOCK'] }
const routes = (state: (typeof HY_STATES)[number]) => [{ method: 'GET' as const, path: '/notification-config', status: state === 'error-5xx' ? 503 : 200, json: state === 'error-5xx' ? { message: 'Servicio no disponible (e2e)' } : config, deferred: state === 'loading' }, { method: 'GET' as const, path: '/users/assignable', json: [{ id: 'e2e-user-1', name: 'Usuario E2E' }] }]

function record(viewport: ViewportCase, stateId: string, result: { assertionId: ResponsiveEvidenceRecord['assertionId']; status: ResponsiveEvidenceRecord['status']; measurements: Record<string, unknown>; failure?: ResponsiveEvidenceRecord['failure']; exclusion?: ResponsiveEvidenceRecord['exclusion'] }): ResponsiveEvidenceRecord {
  const rule = ASSERTION_EVIDENCE_RULES[result.assertionId]
  return { schemaVersion: 1, runId: process.env.RESPONSIVE_RUN_ID?.trim() || 'local-run', authority: rule.authority, surfaceId: 'HY-04', archetype: 'HY', route: HY04_NOTIFICATIONS.route, fixtureId: HY04_NOTIFICATIONS.fixtureId, stateId, viewport, strategy: HY04_NOTIFICATIONS.strategy, effectiveMode: 'stacked', containerOwner: HY04_NOTIFICATIONS.containerOwner, assertionId: result.assertionId, riskIds: rule.riskIds, regions: { owner: { locator: '[data-testid="notifications-card-actions"]' }, surface: { locator: '[data-testid="actions-accordion"]' }, related: [{ label: 'save footer', locator: '[data-testid="notifications-footer"]' }] }, status: result.status, measurements: result.measurements, ...(result.failure ? { failure: result.failure } : {}), ...(result.exclusion ? { exclusion: result.exclusion } : {}) }
}

async function openNotifications(page: Parameters<typeof HY04_NOTIFICATIONS.resolve>[0], viewport: ViewportCase, state: (typeof HY_STATES)[number]) {
  await page.setViewportSize(viewport); await seedAuthSession(page); await page.goto(`${RESPONSIVE_ORIGIN}${HY04_NOTIFICATIONS.route}`)
  await (state === 'loading' ? page.locator('[class*="animate-pulse"]').first() : page.getByTestId('notifications-card-actions')).waitFor()
}

test.describe('HY-04 strict responsive conformance', () => {
  for (const viewport of RESPONSIVE_VIEWPORTS) for (const state of HY_STATES) test.describe(`${viewport.key} ${state}`, () => {
    test.use({ declaredRoutes: { routes: routes(state) } })
    test('records hydrated/loading/error state, no-scroll geometry, footer, and switches', async ({ page, evidenceSession, strictNetwork }) => {
      await openNotifications(page, viewport, state)
      if (state === 'loading') {
        const visible = await page.locator('[class*="animate-pulse"]').count() > 0
        evidenceSession.attach(record(viewport, state, { assertionId: 'surface-state', status: visible ? 'pass' : 'fail', measurements: { visible }, ...(visible ? {} : { failure: { taxonomy: 'state-usability', message: 'loading state lacks visible feedback' } }) }))
        expect(visible).toBe(true); return
      }
      const owner = page.getByRole('main')
      const resolved = state === 'error-5xx' ? undefined : await HY04_NOTIFICATIONS.resolve(page)
      const surface = resolved?.anchor ?? owner.getByTestId('notifications-query-error')
      const results: Array<{ assertionId: ResponsiveEvidenceRecord['assertionId']; status: 'pass' | 'fail'; measurements: Record<string, unknown>; failure?: ResponsiveEvidenceRecord['failure'] }> = [await assertExactViewport(page, viewport), await assertDocumentNoHorizontalOverflow(page), await assertBoxesWithinOwner(owner, { surface })]
      if (!resolved) { const queryError = await page.getByTestId('notifications-query-error').count(); results.push({ assertionId: 'surface-state', status: queryError === 1 ? 'pass' : 'fail', measurements: { queryError }, ...(queryError === 1 ? {} : { failure: { taxonomy: 'state-usability', message: 'HY-04 query error lacks a distinct recovery surface' } }) }) }
      else results.push(await assertOverflowContract({ policy: 'no-horizontal-scroll', owner: resolved.anchor, recordRegions: Array.from({ length: await resolved.states.actionRows.count() }, (_, index) => resolved.states.actionRows.nth(index)) }), await assertMinimumTargets([{ id: 'master-switch', locator: page.getByRole('switch', { name: 'Notificaciones' }) }, { id: 'save', locator: resolved.actions.save }]), await assertNamedControls([{ id: 'master-switch', locator: page.getByRole('switch', { name: 'Notificaciones' }), role: 'switch', name: 'Notificaciones' }]))
      for (const result of results) evidenceSession.attach(record(viewport, state, result))
      if (state === 'success') for (const exclusion of HY04_NOTIFICATIONS.exclusions) evidenceSession.attach(record(viewport, exclusion.stateId ?? 'excluded', { assertionId: exclusion.assertionId, status: 'excluded', measurements: {}, exclusion: { reason: exclusion.reason, followUp: exclusion.followUp } }))
      expect(strictNetwork.violations()).toEqual([])
      expect(results.map((result) => result.status)).toEqual(results.map(() => 'pass'))
    })
  })
})
