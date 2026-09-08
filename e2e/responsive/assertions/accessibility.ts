/** Target-independent semantic, target-size, keyboard, focus, and overlay lifecycle assertions for browser evidence. */
import type { Locator, Page } from '@playwright/test'
import { MEASUREMENT_TOLERANCE_PX, type FailureTaxonomy } from '../evidence/schema'

const TOL = MEASUREMENT_TOLERANCE_PX
export type SemanticAssertionId = 'minimum-targets' | 'semantics' | 'keyboard' | 'focus' | 'overlay-lifecycle'
export interface InteractionFailure { taxonomy: FailureTaxonomy; message: string; expected?: unknown; actual?: unknown }
export interface InteractionResult { assertionId: SemanticAssertionId; status: 'pass' | 'fail'; measurements: Record<string, unknown>; failure?: InteractionFailure }
const pass = (assertionId: SemanticAssertionId, measurements: Record<string, unknown>): InteractionResult => ({ assertionId, status: 'pass', measurements })
const fail = (assertionId: SemanticAssertionId, taxonomy: FailureTaxonomy, message: string, expected: unknown, actual: unknown, measurements: Record<string, unknown>): InteractionResult =>
  ({ assertionId, status: 'fail', measurements, failure: { taxonomy, message, expected, actual } })
/** Accessible name of an element: aria-labelledby chain, aria-label, trimmed text content, then the `<label for>` of a labelable control. */
export const accessibleNameOf = (locator: Locator): Promise<string> =>
  locator.evaluate((el) => {
    const labelledby = el.getAttribute('aria-labelledby')
    if (labelledby) return labelledby.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim()
    const ariaLabel = el.getAttribute('aria-label')
    if (ariaLabel) return ariaLabel
    const direct = (el.textContent ?? '').trim()
    if (direct.length > 0) return direct
    const id = el.getAttribute('id')
    const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null
    return (label?.textContent ?? '').trim()
  })
/** Role (explicit attribute or tag name) and accessible name of the focused element, null when focus sits on body. */
const describeFocused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return null
    return { role: el.getAttribute('role') ?? el.tagName.toLowerCase(), name: el.getAttribute('aria-label') ?? (el.textContent ?? '').trim() }
  })
export interface NamedControl { id: string; locator: Locator; role: string; name: string }
export async function assertNamedControls(controls: readonly NamedControl[]): Promise<InteractionResult> {
  const measured: Record<string, unknown> = {}
  for (const control of controls) {
    const role = await control.locator.evaluate((el) => el.getAttribute('role') ?? el.tagName.toLowerCase())
    const found = { role, name: await accessibleNameOf(control.locator) }
    measured[control.id] = found
    if (found.role !== control.role || found.name !== control.name)
      return fail('semantics', 'semantic-or-name', `${control.id} does not expose its declared role and accessible name`, { role: control.role, name: control.name }, found, measured)
  }
  return pass('semantics', measured)
}
export interface NativeTableContract { name: string; columns: readonly string[]; minRows: number }
export async function assertNativeTableSemantics(table: Locator, contract: NativeTableContract): Promise<InteractionResult> {
  const metrics = await table.evaluate((el) => {
    const rows = Array.from(el.querySelectorAll('tr'))
    return {
      name: el.getAttribute('aria-label') ?? el.querySelector('caption')?.textContent?.trim() ?? '', headers: Array.from(el.querySelectorAll('th,[role="columnheader"]')).map((cell) => (cell.textContent ?? '').trim()),
      rowCount: rows.length, cellsPerRow: rows.map((row) => row.querySelectorAll('td,th').length),
    }
  })
  const missing = contract.columns.filter((column) => !metrics.headers.includes(column))
  if (!metrics.name || missing.length > 0 || metrics.rowCount < contract.minRows || metrics.cellsPerRow.some((cells) => cells === 0))
    return fail('semantics', 'semantic-or-name', 'native table lacks its name/caption, declared column headers, or row/cell relationships', contract, metrics, {})
  return pass('semantics', { table: metrics })
}
export interface CollectionAction { locator: Locator; name: string; verify?: (page: Page) => Promise<boolean> }
/** One table-equivalent field an item must show: an optional label and/or a value text, measured inside the item. */
export interface CollectionField { label?: string; value?: string }
export interface CollectionItem { identity: string; item: Locator; action?: CollectionAction; fields?: readonly CollectionField[] }
export interface CollectionContract { list: Locator; items: readonly CollectionItem[] }
const LIST_ROLES = ['ul', 'ol', 'list'], ITEM_ROLES = ['li', 'listitem', 'article']
export async function assertCollectionSemantics(contract: CollectionContract): Promise<InteractionResult> {
  const list = await contract.list.evaluate((el) => ({
    role: el.getAttribute('role') ?? el.tagName.toLowerCase(),
    items: Array.from(el.children).map((child) => (child as HTMLElement).getAttribute('role') ?? (child as HTMLElement).tagName.toLowerCase()),
  }))
  const measured: Record<string, unknown> = { list }
  // Role defects never short-circuit: every declared item/field/action is still measured,
  // and exactly one genuine semantic fail is returned afterwards with the full evidence.
  let failure: InteractionResult | null = !LIST_ROLES.includes(list.role) || !contract.items.every((_, index) => ITEM_ROLES.includes(list.items[index] ?? ''))
    ? fail('semantics', 'semantic-or-name', 'collection lacks list/listitem/article semantics', { list: 'ul|ol|list', items: 'li|listitem|article' }, list, measured)
    : null
      for (const [index, entry] of contract.items.entries()) {
        // A declared item locator must resolve exactly once without waiting; otherwise record the
        // genuine semantic fail immediately so a missing locator can never stall the measurement.
        if ((await entry.item.count()) !== 1) {
          measured[`items[${index}]`] = { identity: null, resolved: false }
          failure ??= fail('semantics', 'semantic-or-name', `collection item ${index} locator did not resolve exactly once for identity measurement`, { identity: entry.identity }, measured[`items[${index}]`], measured)
          continue
        }
        const identity = await entry.item.evaluate((el) => (el.textContent ?? '').trim())
    const actionName = entry.action ? await accessibleNameOf(entry.action.locator) : ''
    const fields: Record<string, unknown> = {}
    for (const [fieldIndex, field] of (entry.fields ?? []).entries()) {
      const labelVisible = field.label ? await entry.item.getByText(field.label, { exact: true }).isVisible() : true
      const valueVisible = field.value ? await entry.item.getByText(field.value, { exact: false }).first().isVisible() : true
      fields[`fields[${fieldIndex}]`] = { ...field, labelVisible, valueVisible }
      if (!labelVisible || !valueVisible)
        failure ??= fail('semantics', 'semantic-or-name', `collection item ${index} lacks table-equivalent field evidence`, field, fields[`fields[${fieldIndex}]`], measured)
    }
    measured[`items[${index}]`] = { identity, action: actionName, fields }
    if (!identity.includes(entry.identity) || (entry.action && actionName !== entry.action.name))
      failure ??= fail('semantics', 'semantic-or-name', `collection item ${index} lacks its declared identity or named primary action`, entry, measured[`items[${index}]`], measured)
    if (entry.action?.verify && !failure) {
      await entry.action.locator.press('Enter')
      if (!(await entry.action.verify(entry.action.locator.page())))
        failure = fail('keyboard', 'keyboard-activation', `collection item ${index} primary action did not produce the table-equivalent outcome`, true, false, measured)
    }
  }
  return failure ?? pass('semantics', measured)
}
/** Policy hit-area floor in CSS px; measured on the actionable element or its declared hit area, never the visual icon. */
export const TARGET_FLOOR_PX = 44; export interface TargetSizeInput { id: string; locator: Locator; hitArea?: Locator; disabled?: boolean }
export async function assertMinimumTargets(targets: readonly TargetSizeInput[]): Promise<InteractionResult> {
  const measured: Record<string, unknown> = {}
  for (const target of targets) {
    const box = await (target.hitArea ?? target.locator).boundingBox()
    const size = box ? { width: Math.round(box.width * 100) / 100, height: Math.round(box.height * 100) / 100 } : null
    measured[target.id] = target.disabled ? { ...size, enforcement: 'record-only-disabled' } : size
    if (!target.disabled && (!box || box.width + 0.01 < TARGET_FLOOR_PX || box.height + 0.01 < TARGET_FLOOR_PX))
      return fail('minimum-targets', 'target-size', `${target.id} hit area is below the ${TARGET_FLOOR_PX}x${TARGET_FLOOR_PX} CSS px floor`, { width: TARGET_FLOOR_PX, height: TARGET_FLOOR_PX }, size, measured)
  }
  return pass('minimum-targets', measured)
}
export interface KeyboardStep { id: string; role: string; name: string }
export async function assertKeyboardSequence(page: Page, start: Locator, steps: readonly KeyboardStep[], direction: 'forward' | 'reverse' = 'forward'): Promise<InteractionResult> {
  await start.focus()
  const key = direction === 'forward' ? 'Tab' : 'Shift+Tab'
  const order: unknown[] = []
  for (const step of direction === 'forward' ? steps : [...steps].reverse()) {
    await page.keyboard.press(key)
    const focused = await describeFocused(page)
    order.push(focused)
    if (!focused || focused.role !== step.role || focused.name !== step.name)
      return fail('keyboard', 'focus-order', `focus order diverges from the declared sequence at ${step.id} (${direction})`, step, focused, { direction, order })
  }
  return pass('keyboard', { direction, order })
}
const focusIndicator = (locator: Locator) =>
  locator.evaluate((el) => {
    const style = getComputedStyle(el)
    return { focusVisible: el.matches(':focus-visible'), indicator: (style.outlineStyle !== 'none' && style.outlineWidth !== '0px') || style.boxShadow !== 'none', outline: `${style.outlineStyle} ${style.outlineWidth}`, boxShadow: style.boxShadow }
  })
/** Bounded post-activation outcome poll: absorbs the render race after a keypress without hiding a persistent product failure. */
const BOUNDED_VERIFY_MS = 1_000
const verifyOutcome = async (page: Page, verify: (page: Page) => Promise<boolean>): Promise<boolean> => {
  const deadline = Date.now() + BOUNDED_VERIFY_MS
  if (await verify(page)) return true
  while (Date.now() < deadline) { await page.waitForTimeout(50); if (await verify(page)) return true }
  return false
}
export type ActivationKey = 'Enter' | 'Space'
const ACTIVATION_KEYS: Record<ActivationKey, string> = { Enter: 'Enter', Space: ' ' }; export interface ActivationOutcome { key: ActivationKey; verify: (page: Page) => Promise<boolean> }
export async function assertKeyboardActivation(locator: Locator, outcome: ActivationOutcome): Promise<InteractionResult> {
  await locator.focus()
  const indicator = await focusIndicator(locator)
  if (!indicator.focusVisible || !indicator.indicator)
    return fail('focus', 'focus-obscured', 'focused control lacks :focus-visible with a visible outline or box-shadow indicator', 'focus-visible indicator', indicator, {})
  await locator.press(ACTIVATION_KEYS[outcome.key])
  if (!(await verifyOutcome(locator.page(), outcome.verify)))
    return fail('keyboard', 'keyboard-activation', `${outcome.key} activation did not produce the declared outcome`, true, false, { key: outcome.key, indicator })
  return pass('keyboard', { key: outcome.key, indicator })
}
/** Activates a control after the focus assertion has independently recorded its visual state. */
export async function assertKeyboardAction(locator: Locator, outcome: ActivationOutcome): Promise<InteractionResult> {
  await locator.focus()
  await locator.press(ACTIVATION_KEYS[outcome.key])
  if (!(await verifyOutcome(locator.page(), outcome.verify)))
    return fail('keyboard', 'keyboard-activation', `${outcome.key} activation did not produce the declared outcome`, true, false, { key: outcome.key })
  return pass('keyboard', { key: outcome.key })
}
export async function assertFocusNotObscured(focused: Locator, stickyRegions: readonly Locator[]): Promise<InteractionResult> {
  const box = await focused.boundingBox()
  if (!box) return fail('focus', 'focus-obscured', 'focused control box is missing', 'non-null box', box, {})
  const viewport = await focused.page().evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))
  if (box.x < -TOL || box.y < -TOL || box.x + box.width > viewport.width + TOL || box.y + box.height > viewport.height + TOL)
    return fail('focus', 'focus-obscured', 'focused control extends outside the viewport', 'fully inside the viewport', { viewport, box }, {})
  for (const [index, region] of stickyRegions.entries()) {
    const regionBox = await region.boundingBox()
    if (regionBox && box.x < regionBox.x + regionBox.width && box.x + box.width > regionBox.x && box.y < regionBox.y + regionBox.height && box.y + box.height > regionBox.y)
      return fail('focus', 'focus-obscured', `focused control intersects sticky region ${index}`, 'no sticky intersection', { sticky: regionBox, focused: box }, { viewport, focused: box })
  }
  return pass('focus', { viewport, focused: box, stickyRegions: stickyRegions.length, tolerancePx: TOL })
}
export interface OverlayControl { id: string; role: string; name: string }
export interface OverlayContract {
  trigger: Locator; overlay: Locator; role: string; name: string; controls: readonly OverlayControl[]
  close?: Locator; escape?: boolean; restoreFocusTo?: Locator; invokerRemoved?: boolean
}
export async function assertOverlayLifecycle(page: Page, contract: OverlayContract): Promise<InteractionResult> {
  const measured: Record<string, unknown> = {}
  await contract.trigger.press('Enter')
  const overlay = { role: await contract.overlay.evaluate((el) => el.getAttribute('role') ?? el.tagName.toLowerCase()), name: await accessibleNameOf(contract.overlay) }
  measured.overlay = { visible: await contract.overlay.isVisible(), ...overlay }
  if (!(await contract.overlay.isVisible()) || overlay.role !== contract.role || overlay.name !== contract.name)
    return fail('overlay-lifecycle', 'semantic-or-name', 'opened overlay lacks its declared role and accessible name', { role: contract.role, name: contract.name }, measured.overlay, measured)
  if (!(await contract.overlay.evaluate((el) => el.contains(document.activeElement))))
    return fail('overlay-lifecycle', 'focus-restoration', 'focus did not enter the opened overlay', 'focus inside the overlay', await page.evaluate(() => document.activeElement?.tagName ?? 'none'), measured)
  const order: unknown[] = []
  for (const control of contract.controls) {
    await page.keyboard.press('Tab')
    const focused = await describeFocused(page)
    order.push(focused)
    if (!focused || focused.role !== control.role || focused.name !== control.name)
      return fail('overlay-lifecycle', 'focus-order', `overlay controls are not reachable in the declared order at ${control.id}`, control, focused, { ...measured, order })
  }
  const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))
  const overlayBox = await contract.overlay.boundingBox()
  if (!overlayBox || overlayBox.x < -TOL || overlayBox.x + overlayBox.width > viewport.width + TOL)
    return fail('overlay-lifecycle', 'shell-overlay-containment', 'opened overlay is not contained within the viewport width', viewport, overlayBox, measured)
  if (contract.close) await contract.close.press('Enter')
  else if (contract.escape) await page.keyboard.press('Escape')
  else return fail('overlay-lifecycle', 'harness-or-fixture', 'overlay contract declares no close path', 'close control or escape', contract, measured)
  if (contract.invokerRemoved) { measured.invokerRemoved = true; return pass('overlay-lifecycle', measured) }
  const restored = contract.restoreFocusTo ? await contract.restoreFocusTo.evaluate((el) => el === document.activeElement) : false
  measured.focusRestored = restored
  if (!restored)
    return fail('overlay-lifecycle', 'focus-restoration', 'closing the overlay did not restore focus to the surviving invoker', 'invoker focused', await page.evaluate(() => document.activeElement?.tagName ?? 'none'), measured)
  return pass('overlay-lifecycle', measured)
}