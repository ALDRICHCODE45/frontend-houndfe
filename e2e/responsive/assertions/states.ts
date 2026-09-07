/** Target-independent surface-state usability assertions: loading, fetching, empty, no-match, error, and remaining applicability. */
import type { Locator, Page } from '@playwright/test'
import type { FailureTaxonomy } from '../evidence/schema'
import type { SurfaceStateName } from '../targets/types'
import { accessibleNameOf } from './accessibility'

export interface StateFailure { taxonomy: FailureTaxonomy; message: string; expected?: unknown; actual?: unknown }
export interface StateResult { assertionId: 'surface-state'; status: 'pass' | 'fail'; measurements: Record<string, unknown>; failure?: StateFailure }
export interface UsableControl { id: string; locator: Locator }
/** A recovery or reset step: named control (when declared), apply callback or Enter activation, and outcome verification. */
export interface RecoveryAction { locator: Locator; name?: string; verify?: (page: Page) => Promise<boolean>; apply?: (page: Page) => Promise<void> }
export interface StateContent { locator: Locator; text: string }
/** Observed declared in-flight request evidence: the probe must observe at least `minimum` requests for the state to be substantively loading/fetching. */
export interface InFlightRequests { observed: () => number; minimum: number }
export interface StateContract {
  state: SurfaceStateName; feedback?: Locator; feedbackText?: string; feedbackContains?: string
  content?: StateContent; prohibited?: readonly Locator[]; usableControls?: readonly UsableControl[]
  inFlightRequests?: InFlightRequests; recovery?: RecoveryAction; reset?: RecoveryAction
}

const pass = (measurements: Record<string, unknown>): StateResult => ({ assertionId: 'surface-state', status: 'pass', measurements })
const fail = (message: string, expected: unknown, actual: unknown, measurements: Record<string, unknown>): StateResult =>
  ({ assertionId: 'surface-state', status: 'fail', measurements, failure: { taxonomy: 'state-usability', message, expected, actual } })

/** Runs one declared recovery/reset step and returns its failure reason, or null when the step produced its declared outcome. */
const applyStep = async (label: string, action: RecoveryAction, measured: Record<string, unknown>): Promise<string | null> => {
  const name = await accessibleNameOf(action.locator)
  measured[label] = { name: action.name ?? name }
  if (action.name !== undefined && name !== action.name) return `${label} action is missing or misnamed`
  if (action.apply) await action.apply(action.locator.page())
  else await action.locator.press('Enter')
  if (action.verify && !(await action.verify(action.locator.page()))) return `${label} action did not produce its declared outcome`
  return null
}

export async function assertSurfaceState(contract: StateContract): Promise<StateResult> {
  const measured: Record<string, unknown> = { state: contract.state }
  if (contract.feedback) {
    const feedbackVisible = await contract.feedback.isVisible(), feedbackText = feedbackVisible ? await accessibleNameOf(contract.feedback) : ''
    measured.feedback = { visible: feedbackVisible, text: feedbackText }
    const textMismatch = contract.feedbackText !== undefined ? feedbackText !== contract.feedbackText : contract.feedbackContains !== undefined ? !feedbackText.includes(contract.feedbackContains) : false
    if (!feedbackVisible || textMismatch)
      return fail(`${contract.state} state feedback is missing or ambiguous`, contract.feedbackText ?? contract.feedbackContains ?? 'visible feedback', measured.feedback, measured)
  }
  if (contract.content) {
    const contentVisible = await contract.content.locator.isVisible()
    measured.content = { text: contract.content.text, visible: contentVisible }
    if (!contentVisible) return fail(`${contract.state} state does not render its substantive content`, contract.content.text, measured.content, measured)
  }
  if (contract.inFlightRequests) {
    const observed = contract.inFlightRequests.observed()
    measured.inFlightRequests = { observed, minimum: contract.inFlightRequests.minimum }
    if (observed < contract.inFlightRequests.minimum)
      return fail(`${contract.state} state does not observe its declared in-flight requests`, contract.inFlightRequests.minimum, observed, measured)
  }
  for (const [index, content] of (contract.prohibited ?? []).entries())
    if (await content.isVisible())
      return fail(`${contract.state} state exposes prohibited content`, 'no prohibited content', `prohibited[${index}] visible`, measured)
  const controls: Record<string, unknown> = {}
  for (const control of contract.usableControls ?? []) {
    const visible = await control.locator.isVisible()
    const name = visible ? await accessibleNameOf(control.locator) : ''
    controls[control.id] = { visible, name }
    if (!visible || name.length === 0)
      return fail(`control ${control.id} is not usable during ${contract.state}`, 'visible control with an accessible name', controls[control.id], { ...measured, controls })
  }
  if (contract.recovery) { const error = await applyStep('recovery', contract.recovery, measured); if (error) return fail(error, true, false, measured) }
  if (contract.reset) { const error = await applyStep('reset', contract.reset, measured); if (error) return fail(error, true, false, measured) }
  return pass(measured)
}

export interface FetchUsabilityContract { content: Locator; contentProbe: string; inFlightControls?: readonly UsableControl[]; fetchRequests?: () => number }

/** Proves a held/deferred refetch keeps rendered content usable: content and probe stay visible, an in-flight request is observed, and declared controls stay operable. */
export async function assertFetchKeepsContentUsable(contract: FetchUsabilityContract): Promise<StateResult> {
  const measured: Record<string, unknown> = { state: 'fetching' }
  const contentVisible = await contract.content.isVisible(), probeVisible = contentVisible ? await contract.content.getByText(contract.contentProbe, { exact: false }).first().isVisible() : false
  measured.content = { visible: contentVisible, probe: contract.contentProbe, probeVisible }
  if (!contentVisible || !probeVisible) return fail('content is not visible and usable while the refetch is in flight', contract.contentProbe, measured.content, measured)
  const fetchRequests = contract.fetchRequests?.() ?? -1
  measured.fetchRequests = fetchRequests
  if (contract.fetchRequests && fetchRequests === 0) return fail('no in-flight fetch request was observed for the fetching state', 'at least one declared in-flight request', 0, measured)
  const controls: Record<string, unknown> = {}
  for (const control of contract.inFlightControls ?? []) {
    const visible = await control.locator.isVisible(), name = visible ? await accessibleNameOf(control.locator) : '', disabled = visible ? await control.locator.isDisabled() : true
    controls[control.id] = { visible, name, disabled }
    if (!visible || name.length === 0 || disabled)
      return fail(`control ${control.id} is not operable while the refetch is in flight`, 'enabled control with an accessible name', controls[control.id], { ...measured, controls })
  }
  measured.controls = controls
  return pass(measured)
}
