/** Target-independent surface-state usability assertions: loading, fetching, empty, no-match, error, and remaining applicability. */
import type { Locator, Page } from '@playwright/test'
import type { FailureTaxonomy } from '../evidence/schema'
import type { SurfaceStateName } from '../targets/types'
import { accessibleNameOf } from './accessibility'

export interface StateFailure { taxonomy: FailureTaxonomy; message: string; expected?: unknown; actual?: unknown }
export interface StateResult { assertionId: 'surface-state'; status: 'pass' | 'fail'; measurements: Record<string, unknown>; failure?: StateFailure }
export interface UsableControl { id: string; locator: Locator }
export interface RecoveryAction { locator: Locator; name: string; verify?: (page: Page) => Promise<boolean> }
export interface StateContract {
  state: SurfaceStateName; feedback: Locator; feedbackText: string; prohibited?: readonly Locator[]
  usableControls?: readonly UsableControl[]; recovery?: RecoveryAction
}

const pass = (measurements: Record<string, unknown>): StateResult => ({ assertionId: 'surface-state', status: 'pass', measurements })
const fail = (message: string, expected: unknown, actual: unknown, measurements: Record<string, unknown>): StateResult =>
  ({ assertionId: 'surface-state', status: 'fail', measurements, failure: { taxonomy: 'state-usability', message, expected, actual } })

export async function assertSurfaceState(contract: StateContract): Promise<StateResult> {
  const measured: Record<string, unknown> = { state: contract.state }
  const feedbackVisible = await contract.feedback.isVisible(), feedbackText = feedbackVisible ? await accessibleNameOf(contract.feedback) : ''
  measured.feedback = { visible: feedbackVisible, text: feedbackText }
  if (!feedbackVisible || feedbackText !== contract.feedbackText)
    return fail(`${contract.state} state feedback is missing or ambiguous`, contract.feedbackText, measured.feedback, measured)
  for (const [index, content] of (contract.prohibited ?? []).entries())
    if (await content.isVisible())
      return fail(`${contract.state} state exposes prohibited success content`, 'no success content', `prohibited[${index}] visible`, measured)
  const controls: Record<string, unknown> = {}
  for (const control of contract.usableControls ?? []) {
    const visible = await control.locator.isVisible()
    const name = visible ? await accessibleNameOf(control.locator) : ''
    controls[control.id] = { visible, name }
    if (!visible || name.length === 0)
      return fail(`control ${control.id} is not usable during ${contract.state}`, 'visible control with an accessible name', controls[control.id], { ...measured, controls })
  }
  if (contract.recovery) {
    const name = await accessibleNameOf(contract.recovery.locator); measured.recovery = { name }
    if (name !== contract.recovery.name)
      return fail('recovery action is missing or misnamed', contract.recovery.name, name, measured)
    await contract.recovery.locator.press('Enter')
    if (contract.recovery.verify && !(await contract.recovery.verify(contract.recovery.locator.page())))
      return fail('recovery action did not produce its declared outcome', true, false, measured)
  }
  return pass(measured)
}
