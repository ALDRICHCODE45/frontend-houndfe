import { test, expect, RESPONSIVE_ORIGIN } from '../fixtures/test'
import type { Locator } from '@playwright/test'
import { seedAuthSession } from '../fixtures/auth'
import type { DeclaredRoute } from '../fixtures/network'
import { HY04_NOTIFICATIONS } from '../targets/hy04-notifications'
import { ASSERTION_EVIDENCE_RULES, RESPONSIVE_VIEWPORTS, type ViewportCase } from '../targets/types'
import { assertBoxesWithinOwner, assertDocumentNoHorizontalOverflow, assertExactViewport, assertOverflowContract } from '../assertions/geometry'
import { assertFocusNotObscured, assertKeyboardAction, assertKeyboardActivation, assertKeyboardSequence, assertMinimumTargets, assertNamedControls, type ActivationOutcome, type InteractionResult, type TargetSizeInput } from '../assertions/accessibility'
import { assertSurfaceState } from '../assertions/states'
import type { ResponsiveEvidenceRecord } from '../evidence/schema'

const OWNER = '#hound-dashboard-panel-main-panel'
const HY_STATES = ['loading', 'success', 'error-4xx', 'error-5xx'] as const
type HyState = (typeof HY_STATES)[number]
const CONFIG = { enabled: true, recipients: ['e2e-user-1'], enabledActions: ['LOW_STOCK'] }
const STALE_CONFIG = { enabled: true, recipients: ['ghost-user'], enabledActions: ['LOW_STOCK'] }
const ASSIGNABLE = [{ id: 'e2e-user-1', name: 'Usuario E2E' }]
/** Loading renders bare skeleton cards (no alert DOM); error renders the settings cards with no query-error/retry DOM. */
const LOADING_SURFACE = `${OWNER} div.rounded-lg.border >> nth=0`
const DEFAULT_SURFACE = '[data-testid="notifications-card-actions"]'
const PAGE_HEADING_REGION = { label: 'page heading', locator: '[aria-label="breadcrumb"]' }
const SUCCESS_REGIONS = [
  { label: 'actions accordion', locator: '[data-testid="actions-accordion"]' },
  { label: 'action rows', locator: '[data-testid="action-row-low-stock"]' },
  { label: 'recipients control', locator: '[data-testid="recipient-select-trigger"]' },
  { label: 'save footer', locator: '[data-testid="notifications-footer"]' },
]
const SAVED_TOAST = 'Configuración de notificaciones guardada'
const putBody = (enabled: boolean, recipientUserIds: string[]) => ({ enabled, recipientUserIds, enabledActions: ['LOW_STOCK'] })
const isHyError = (state: HyState): boolean => state.startsWith('error')

const routes = (state: HyState): DeclaredRoute[] => [
  { method: 'GET', path: '/notification-config', status: isHyError(state) ? (state === 'error-4xx' ? 400 : 503) : 200, json: isHyError(state) ? { message: state === 'error-4xx' ? 'Solicitud inválida (e2e)' : 'Servicio no disponible (e2e)' } : CONFIG, deferred: state === 'loading', count: isHyError(state) ? undefined : 1 },
  { method: 'GET', path: '/users/assignable', json: ASSIGNABLE, count: 1 },
]
const saveRoutes: DeclaredRoute[] = [
  { method: 'GET', path: '/notification-config', json: STALE_CONFIG },
  { method: 'GET', path: '/users/assignable', json: ASSIGNABLE },
  { method: 'PUT', path: '/notification-config', body: putBody(false, ['ghost-user']), status: 422, json: { error: 'INVALID_RECIPIENT' }, count: 1 },
  { method: 'PUT', path: '/notification-config', body: putBody(false, ['e2e-user-1']), status: 200, json: { enabled: false, recipients: ['e2e-user-1'], enabledActions: ['LOW_STOCK'] }, count: 1 },
]

type EvidenceResult = Pick<ResponsiveEvidenceRecord, 'assertionId' | 'status' | 'measurements' | 'failure' | 'exclusion'>

function record(viewport: ViewportCase, stateId: string, result: EvidenceResult, surface = DEFAULT_SURFACE): ResponsiveEvidenceRecord {
  const rule = ASSERTION_EVIDENCE_RULES[result.assertionId]
  // Only rendered regions: loading/error states get the page-heading region; success states get the settings regions.
  // A related region equal to the record's own surface (the footer record) is dropped, so owner/surface/related stay distinct.
  const surfaceLocator = surface ?? DEFAULT_SURFACE
  const related = (stateId === 'loading' || stateId.startsWith('error') ? [PAGE_HEADING_REGION] : SUCCESS_REGIONS).filter((region) => region.locator !== surfaceLocator)
  return { schemaVersion: 1, runId: process.env.RESPONSIVE_RUN_ID?.trim() || 'local-run', authority: rule.authority, surfaceId: 'HY-04', archetype: 'HY', route: HY04_NOTIFICATIONS.route, fixtureId: HY04_NOTIFICATIONS.fixtureId, stateId, viewport, strategy: HY04_NOTIFICATIONS.strategy, effectiveMode: 'stacked', containerOwner: HY04_NOTIFICATIONS.containerOwner, assertionId: result.assertionId, riskIds: rule.riskIds, regions: { owner: { locator: OWNER }, surface: { locator: surfaceLocator }, related }, status: result.status, measurements: result.measurements, ...(result.failure ? { failure: result.failure } : {}), ...(result.exclusion ? { exclusion: result.exclusion } : {}) }
}

async function openNotifications(page: Parameters<typeof HY04_NOTIFICATIONS.resolve>[0], viewport: ViewportCase, state: HyState) {
  await page.setViewportSize(viewport); await seedAuthSession(page)
  await page.goto(`${RESPONSIVE_ORIGIN}${HY04_NOTIFICATIONS.route}`)
  // Error states start from the rendered shell owner; only loading/success readiness waits for a specific surface.
  await (state === 'loading' ? page.locator(OWNER).locator('div.rounded-lg.border').first() : state === 'success' ? page.getByTestId('notifications-card-actions') : page.locator(OWNER)).waitFor()
}

/** Always emits two stable records in order — one genuine focus record, then one keyboard activation record; a focus miss is never discarded or relabeled and the keyboard outcome is still proven once. */
async function keyboardEvidence(locator: Locator, outcome: ActivationOutcome): Promise<InteractionResult[]> {
  const activation = await assertKeyboardActivation(locator, outcome)
  if (activation.assertionId === 'focus') return [activation, await assertKeyboardAction(locator, outcome)]
  return [{ assertionId: 'focus', status: 'pass', measurements: { indicator: activation.measurements.indicator } }, activation]
}
const within = (probe: Locator, timeout = 5_000) => async (): Promise<boolean> => {
  try { await probe.waitFor({ state: 'visible', timeout }); return true } catch { return false }
}

test.describe('HY-04 strict responsive conformance', () => {
  // Every path, including a loading early return or a failed assertion, ends with the strict network audit.
  test.afterEach(async ({ strictNetwork }) => {
    expect(strictNetwork.violations(), 'strict network must end every HY-04 path without violations').toEqual([])
  })

  for (const viewport of RESPONSIVE_VIEWPORTS) for (const state of HY_STATES) test.describe(`${viewport.key} ${state}`, () => {
    test.use({ declaredRoutes: { routes: routes(state) } })
    test('C3 state: records substantive state feedback, no-scroll ownership, and recovery surfaces', async ({ page, strictNetwork, evidenceSession }) => {
      await openNotifications(page, viewport, state)
      const owner = page.locator(OWNER)
      const skeletonCard = owner.locator('div.rounded-lg.border').first()
      const surface = state === 'loading' ? skeletonCard : owner.getByTestId('notifications-card-actions')
      const recordSurface = state === 'loading' ? LOADING_SURFACE : undefined
      const results: EvidenceResult[] = []
      // Every record attaches the moment it is measured, so a later failure can never blank the evidence; the footer keeps its own identity and surface.
      const push = (result: EvidenceResult, id: string = state, surface: string | undefined = recordSurface) => { results.push(result); evidenceSession.attach(record(viewport, id, result, surface)) }
      push(await assertExactViewport(page, viewport)); push(await assertDocumentNoHorizontalOverflow(page))
      if (state === 'loading') {
        push(await assertBoxesWithinOwner(owner, { surface }))
        push(await assertSurfaceState({ state: 'loading', feedback: skeletonCard, prohibited: [page.getByRole('switch', { name: 'Notificaciones' })], inFlightRequests: { observed: () => strictNetwork.requests().filter((request) => request.path === '/notification-config').length, minimum: 1 } }))
      } else if (isHyError(state)) {
        // Error evidence is measured first, from the rendered error controls, independent of any success-only card readiness.
        const errorControls = await owner.getByTestId('notifications-query-error').count()
        const retryControls = await owner.getByRole('button', { name: 'Reintentar' }).count()
        const usable = errorControls > 0 && retryControls > 0
        push(usable
          ? { assertionId: 'surface-state', status: 'pass', measurements: { state: 'error', errorControls, retryControls } }
          : { assertionId: 'surface-state', status: 'fail', measurements: { state: 'error', errorControls, retryControls }, failure: { taxonomy: 'state-usability', message: 'error state renders neither query-error feedback nor a retry control', expected: { errorControls: 1, retryControls: 1 }, actual: { errorControls, retryControls } } })
        push(await assertBoxesWithinOwner(owner, { surface }))
      } else {
        // The success branch is the only consumer of resolve(): declaring it here keeps `resolved` provably defined without type assertions.
        const resolved = await HY04_NOTIFICATIONS.resolve(page)
        push(await assertOverflowContract({ policy: 'no-horizontal-scroll', owner, recordRegions: [owner.getByTestId('notifications-card-master'), owner.getByTestId('notifications-card-recipients'), owner.getByTestId('notifications-card-actions'), owner.getByTestId('notifications-footer')] }))
        push(await assertSurfaceState({ state: 'success', feedback: owner.getByTestId('master-toggle-badge'), feedbackText: 'Activadas', content: { locator: owner.getByTestId('action-row-low-stock'), text: 'Bajo inventario' }, prohibited: [owner.getByTestId('notifications-query-error')] }))
        push(await assertBoxesWithinOwner(owner, { footer: resolved.states.footer }), `${state}-footer`, '[data-testid="notifications-footer"]')
        for (const exclusion of HY04_NOTIFICATIONS.exclusions) evidenceSession.attach(record(viewport, 'excluded', { assertionId: exclusion.assertionId, status: 'excluded', measurements: {}, exclusion: { reason: exclusion.reason, followUp: exclusion.followUp } }))
      }
      expect(strictNetwork.violations()).toEqual([])
      // Evidence integrity is validated separately from product conformance: every state result must be a
      // completed record — a pass or a classified failure — and each was attached the moment it was measured,
      // with zero setup/reporter errors still mandatory. Contract: openspec/changes/responsive-table-contract-and-evidence/design.md and tasks.md.
      expect(results.every((result) => result.status === 'pass' || (result.status === 'fail' && result.failure !== undefined)), 'every HY-04 state record must be completed, classified evidence').toBe(true)
      // Product defects are reported explicitly as conformance RED: failed records stay failures in evidence,
      // keep this assertion unsuppressed and the conformance command exit nonzero, and are never relabeled as passes.
      const defects = results.filter((result) => result.status === 'fail')
      expect(defects.map((defect) => `${defect.assertionId}: ${defect.failure?.message ?? 'unclassified'}`), 'known product defects stay RED until the product renders error feedback and retry controls').toEqual([])
    })
  })

  for (const viewport of RESPONSIVE_VIEWPORTS) test.describe(`${viewport.key} interaction`, () => {
    test.use({ declaredRoutes: { routes: routes('success') } })
    test('C3 interaction: measures switches, recipients, and footer save semantics, targets, keyboard, and focus', async ({ page, strictNetwork, evidenceSession }) => {
      await openNotifications(page, viewport, 'success')
      const owner = page.locator(OWNER)
      const resolved = await HY04_NOTIFICATIONS.resolve(page)
      const master = page.getByRole('switch', { name: 'Notificaciones' })
      const posSwitch = owner.getByRole('switch', { name: 'Bajo inventario' })
      const trigger = owner.getByTestId('recipient-select-trigger')
      const chipRemove = owner.getByRole('button', { name: 'Quitar Usuario E2E' })
      const save = resolved.actions.save
      const footer = resolved.states.footer
      const attached: EvidenceResult[] = []
      const semantic = await assertNamedControls([
        { id: 'master-switch', locator: master, role: 'switch', name: 'Notificaciones' },
        { id: 'action-switch', locator: posSwitch, role: 'switch', name: 'Bajo inventario' },
        { id: 'recipient-trigger', locator: trigger, role: 'button', name: 'Buscar usuarios...' },
        { id: 'chip-remove', locator: chipRemove, role: 'button', name: 'Quitar Usuario E2E' },
        { id: 'save', locator: save, role: 'button', name: 'Guardar cambios' },
      ])
      attached.push(semantic); evidenceSession.attach(record(viewport, 'success-semantics', semantic))
      for (const [stateId, content] of [['success-recipients-summary', { locator: owner.getByTestId('recipient-summary'), text: '1 seleccionados' }], ['success-recipients-chips', { locator: owner.getByTestId('recipient-chips'), text: 'Usuario E2E' }]] as const) {
        const result = await assertSurfaceState({ state: 'success', content })
        attached.push(result); evidenceSession.attach(record(viewport, stateId, result))
      }
      const targets: readonly (readonly [string, TargetSizeInput])[] = [
        ['master-switch', { id: 'master-switch', locator: master }], ['action-switch', { id: 'action-switch', locator: posSwitch }],
        ['recipient-trigger', { id: 'recipient-trigger', locator: trigger }], ['chip-remove', { id: 'chip-remove', locator: chipRemove }], ['save', { id: 'save', locator: save }],
      ]
      for (const [id, target] of targets) { const result = await assertMinimumTargets([target]); attached.push(result); evidenceSession.attach(record(viewport, `success-target-${id}`, result)) }
      const focused: readonly (readonly [string, Locator, readonly Locator[]])[] = [
        ['master-switch', master, [footer]], ['action-switch', posSwitch, [footer]], ['recipient-trigger', trigger, [footer]], ['chip-remove', chipRemove, [footer]], ['save', save, []],
      ]
      for (const [id, locator, sticky] of focused) { await locator.focus(); const result = await assertFocusNotObscured(locator, sticky); attached.push(result); evidenceSession.attach(record(viewport, `success-focus-${id}`, result)) }
      const orderResults = [
        await assertKeyboardSequence(page, master, [{ id: 'recipient-trigger', role: 'button', name: 'Buscar usuarios...' }]),
        await assertKeyboardSequence(page, trigger, [{ id: 'chip-remove', role: 'button', name: 'Quitar Usuario E2E' }]),
        await assertKeyboardSequence(page, owner.getByRole('button', { name: /Entregas/ }), [{ id: 'save', role: 'button', name: 'Guardar cambios' }]),
      ]
      orderResults.forEach((result, index) => { attached.push(result); evidenceSession.attach(record(viewport, `success-focus-order-${index}`, result)) })
      const recipientKeyboard = await keyboardEvidence(trigger, { key: 'Enter', verify: within(page.getByRole('option', { name: 'Usuario E2E' })) })
      recipientKeyboard.forEach((result, index) => { attached.push(result); evidenceSession.attach(record(viewport, `success-keyboard-recipient-${index}`, result)) })
      await page.keyboard.press('Escape')
          const hrTrigger = owner.getByRole('button', { name: /Recursos Humanos/ })
          const accordionKeyboard = await keyboardEvidence(hrTrigger, { key: 'Enter', verify: async () => (await hrTrigger.getAttribute('aria-expanded')) === 'true' })
          accordionKeyboard.forEach((result, index) => { attached.push(result); evidenceSession.attach(record(viewport, `success-keyboard-accordion-${index}`, result)) })
          // Immediate count/isVisible audit after keyboard evidence; never wait on the hidden switch.
          const hrSwitch = owner.getByRole('switch', { name: 'Solicitud de validación' })
          const hrSwitchCount = await hrSwitch.count()
          const hrSwitchVisible = hrSwitchCount === 1 && await hrSwitch.isVisible()
          if (hrSwitchVisible) {
            const hrTarget = await assertMinimumTargets([{ id: 'hr-switch', locator: hrSwitch }]); attached.push(hrTarget); evidenceSession.attach(record(viewport, 'success-target-hr-switch', hrTarget))
            const hrSemantic = await assertNamedControls([{ id: 'hr-switch', locator: hrSwitch, role: 'switch', name: 'Solicitud de validación' }]); attached.push(hrSemantic); evidenceSession.attach(record(viewport, 'success-semantics-hr', hrSemantic))
            const hrBefore = await hrSwitch.getAttribute('data-state')
            const hrKeyboard = await keyboardEvidence(hrSwitch, { key: 'Enter', verify: async () => (await hrSwitch.getAttribute('data-state')) !== hrBefore })
            hrKeyboard.forEach((result, index) => { attached.push(result); evidenceSession.attach(record(viewport, `success-keyboard-hr-switch-${index}`, result)) })
          } else {
            const hrFailure: EvidenceResult = { assertionId: 'surface-state', status: 'fail', measurements: { hrSwitchCount, hrSwitchVisible }, failure: { taxonomy: 'state-usability', message: 'HR switch did not become visible after keyboard accordion activation', expected: 'exactly one visible Solicitud de validación switch', actual: { hrSwitchCount, hrSwitchVisible } } }
            attached.push(hrFailure); evidenceSession.attach(record(viewport, 'success-hr-switch-state', hrFailure))
          }
      const masterBefore = await master.getAttribute('data-state')
      const masterKeyboard = await keyboardEvidence(master, { key: 'Enter', verify: async () => (await master.getAttribute('data-state')) !== masterBefore })
      masterKeyboard.forEach((result, index) => { attached.push(result); evidenceSession.attach(record(viewport, `success-keyboard-master-${index}`, result)) })
      expect(strictNetwork.violations()).toEqual([])
      expect(attached.map((result) => result.status)).toEqual(attached.map(() => 'pass'))
    })
  })

  for (const viewport of RESPONSIVE_VIEWPORTS) test.describe(`${viewport.key} save recovery`, () => {
    test.use({ declaredRoutes: { routes: saveRoutes } })
    test('C3 save: exercises the stale-recipient save error, recovery, and successful overwrite', async ({ page, strictNetwork, evidenceSession }) => {
      await openNotifications(page, viewport, 'success')
      const owner = page.locator(OWNER)
      const resolved = await HY04_NOTIFICATIONS.resolve(page)
      const master = page.getByRole('switch', { name: 'Notificaciones' })
      const trigger = owner.getByTestId('recipient-select-trigger')
      const save = resolved.actions.save
      const staleChip = owner.getByTestId('recipient-chip-ghost-user')
      const removeStale = owner.getByRole('button', { name: 'Quitar Usuario no disponible' })
      const fieldError = owner.getByTestId('recipient-error')
      const toast = page.getByText(SAVED_TOAST)
          const attached: EvidenceResult[] = []
          const push = (stateId: string, result: EvidenceResult) => { attached.push(result); evidenceSession.attach(record(viewport, stateId, result)) }
          const putBodies = () => strictNetwork.requests().filter((request) => request.method === 'PUT').map((request) => JSON.stringify(request.body))
          push('save-stale-content', await assertSurfaceState({ state: 'success', content: { locator: staleChip, text: 'Usuario no disponible' }, prohibited: [fieldError] }))
          await master.press('Enter') // dirties the form while the stale recipient is still assigned
          for (const [index, result] of (await keyboardEvidence(save, { key: 'Enter', verify: within(fieldError) })).entries()) push(`save-keyboard-${index}`, result)
          push('save-field-error', await assertSurfaceState({ state: 'error', feedback: fieldError, feedbackText: 'Uno de los usuarios seleccionados no pertenece a esta cuenta' }))
          // Recovery is measured step by step with bounded probes; the second PUT is proven from the network log, never from the configured route count.
          await removeStale.press('Enter')
          push('save-recovery-remove', await assertSurfaceState({ state: 'success', content: { locator: owner.getByTestId('recipient-summary'), text: '0 seleccionados' }, prohibited: [staleChip] }))
          await trigger.press('Enter')
          await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.keyboard.press('Escape')
          const reselected = await within(owner.getByTestId('recipient-chip-e2e-user-1'), 5_000)()
          push('save-recovery-select', reselected
            ? await assertSurfaceState({ state: 'success', content: { locator: owner.getByTestId('recipient-chip-e2e-user-1'), text: 'Usuario E2E' } })
            : { assertionId: 'surface-state', status: 'fail', measurements: { reselected }, failure: { taxonomy: 'state-usability', message: 'recovery selection did not re-add Usuario E2E through the rendered recipient popup', expected: 'visible Usuario E2E chip', actual: { reselected } } })
          const retryable = reselected && await save.isEnabled()
          if (retryable) {
            await save.press('Enter')
            const toastVisible = await within(toast, 5_000)()
            const puts = putBodies()
            const expectedPuts = [JSON.stringify(putBody(false, ['ghost-user'])), JSON.stringify(putBody(false, ['e2e-user-1']))]
            // The toast may be absent after the bounded probe: measure it directly instead of handing a possibly-absent locator to a waiting assertion.
            const toastText = toastVisible ? (await toast.innerText()).trim() : ''
            const fieldErrorVisible = await fieldError.isVisible()
            const exactPuts = JSON.stringify(puts) === JSON.stringify(expectedPuts)
            const recovered = toastVisible && toastText === SAVED_TOAST && exactPuts && !fieldErrorVisible
            push('save-recovery', recovered
              ? { assertionId: 'surface-state', status: 'pass', measurements: { state: 'success', toastVisible, toastText, putBodies: puts, fieldErrorVisible } }
              : { assertionId: 'surface-state', status: 'fail', measurements: { toastVisible, toastText, putBodies: puts, fieldErrorVisible }, failure: { taxonomy: 'state-usability', message: 'recovery did not complete the 422-then-recovered PUT sequence with a saved toast', expected: { toastVisible: true, toastText: SAVED_TOAST, putBodies: expectedPuts, fieldErrorVisible: false }, actual: { toastVisible, toastText, putBodies: puts, fieldErrorVisible } } })
          } else {
            push('save-recovery', { assertionId: 'surface-state', status: 'fail', measurements: { reselected, retryable }, failure: { taxonomy: 'state-usability', message: 'the rendered product does not permit a retry save after stale-recipient recovery', expected: 'enabled save control after recovery', actual: { reselected, retryable } } })
          }
          expect(strictNetwork.violations()).toEqual([])
          expect(attached.map((result) => result.status)).toEqual(attached.map(() => 'pass'))
    })
  })
})
