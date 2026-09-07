/** Target-independent browser geometry assertions: viewport, containment, overflow, long data, extremes, sticky/pinned. */
import type { Locator, Page } from '@playwright/test'
import { MEASUREMENT_TOLERANCE_PX, type FailureTaxonomy, type GeometryBox, type ScrollExtreme, type ScrollExtremeMeasurement } from '../evidence/schema'
import type { OverflowPolicy, ViewportCase } from '../targets/types'

const TOL = MEASUREMENT_TOLERANCE_PX

export interface GeometryFailure { taxonomy: FailureTaxonomy; message: string; expected?: unknown; actual?: unknown }

export interface GeometryResult { assertionId: 'exact-viewport' | 'document-overflow' | 'owner-containment' | 'overflow-contract' | 'long-data' | 'scroll-extremes' | 'sticky-pinned-alignment'; status: 'pass' | 'fail'; measurements: Record<string, unknown>; failure?: GeometryFailure }

type RawBox = { x: number; y: number; width: number; height: number }

const toBox = (r: RawBox): GeometryBox => ({ ...r, top: r.y, right: r.x + r.width, bottom: r.y + r.height, left: r.x })

const pass = (assertionId: GeometryResult['assertionId'], measurements: Record<string, unknown>): GeometryResult =>
  ({ assertionId, status: 'pass', measurements })

const fail = (assertionId: GeometryResult['assertionId'], taxonomy: FailureTaxonomy, message: string, expected: unknown, actual: unknown, measurements: Record<string, unknown>): GeometryResult =>
  ({ assertionId, status: 'fail', measurements, failure: { taxonomy, message, expected, actual } })

const isScrollable = (overflowX: string): boolean => overflowX === 'auto' || overflowX === 'scroll'

/** True when the element's border box intersects the viewport; isVisible alone ignores scrolled-out elements. */
const inViewport = (locator: Locator): Promise<boolean> =>
  locator.evaluate((el) => {
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < window.innerWidth && rect.bottom > 0 && rect.top < window.innerHeight
  })

interface RegionMetrics { scrollWidth: number; clientWidth: number; contentWidth: number; overflowX: string; overflowAmount: number }

/** Measures scroll metrics; contentWidth uses unclipped descendant boxes so ancestor clipping cannot fake a pass. */
const measureRegion = (locator: Locator): Promise<RegionMetrics> =>
  locator.evaluate((el) => {
    const rect = el.getBoundingClientRect()
    let contentRight = el.scrollWidth
    for (const child of Array.from(el.querySelectorAll<HTMLElement>('*'))) {
      const childRect = child.getBoundingClientRect()
      if (childRect.width > 0) contentRight = Math.max(contentRight, childRect.right - rect.left)
    }
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, contentWidth: Math.ceil(contentRight), overflowX: getComputedStyle(el).overflowX }
  }).then((m) => ({ ...m, overflowAmount: m.contentWidth - m.clientWidth }))

const withinOwner = (box: RawBox, owner: RawBox): boolean =>
  box.x >= owner.x - TOL && box.x + box.width <= owner.x + owner.width + TOL

export async function assertExactViewport(page: Page, viewport: ViewportCase): Promise<GeometryResult> {
  const measured = await page.evaluate(() => ({
    innerWidth: window.innerWidth, innerHeight: window.innerHeight,
    documentClientWidth: document.documentElement.clientWidth, documentClientHeight: document.documentElement.clientHeight,
  }))
  if (measured.innerWidth !== viewport.width || measured.innerHeight !== viewport.height)
    return fail('exact-viewport', 'harness-or-fixture', 'rendered viewport does not equal the declared matrix viewport', { width: viewport.width, height: viewport.height }, measured, { ...measured, declared: viewport })
  return pass('exact-viewport', { ...measured, declared: viewport })
}

export async function assertDocumentNoHorizontalOverflow(page: Page): Promise<GeometryResult> {
  const measured = await page.evaluate(() => {
    const metrics = (el: HTMLElement) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth })
    return { html: metrics(document.documentElement), body: metrics(document.body) }
  })
  for (const [element, m] of Object.entries(measured)) {
    if (m.scrollWidth > m.clientWidth + TOL)
      return fail('document-overflow', 'document-overflow', `${element} exceeds document client width beyond the 1px tolerance`, m.clientWidth, m.scrollWidth, { ...measured, tolerancePx: TOL })
  }
  return pass('document-overflow', { ...measured, tolerancePx: TOL })
}

export async function assertBoxesWithinOwner(owner: Locator, elements: Record<string, Locator>): Promise<GeometryResult> {
  const ownerBox = await owner.boundingBox()
  if (!ownerBox || ownerBox.width <= 0 || ownerBox.height <= 0) return fail('owner-containment', 'surface-outside-owner', 'declared owner box is missing or zero-sized', 'non-null positive box', ownerBox, {})
  const boxes: Record<string, GeometryBox | null> = {}
  for (const [name, locator] of Object.entries(elements)) {
    const elementBox = await locator.boundingBox()
    boxes[name] = elementBox ? toBox(elementBox) : null
    if (!elementBox || elementBox.width <= 0 || elementBox.height <= 0)
      return fail('owner-containment', 'surface-outside-owner', `${name} box is missing or zero-sized`, 'non-null positive box', elementBox, { owner: toBox(ownerBox), boxes })
    if (!withinOwner(elementBox, ownerBox))
      return fail('owner-containment', 'surface-outside-owner', `${name} escapes its declared owner horizontally`, { left: ownerBox.x, right: ownerBox.x + ownerBox.width }, { left: elementBox.x, right: elementBox.x + elementBox.width }, { owner: toBox(ownerBox), boxes, tolerancePx: TOL })
  }
  return pass('owner-containment', { owner: toBox(ownerBox), boxes, tolerancePx: TOL })
}

export interface OverflowContractInput { policy: OverflowPolicy; owner: Locator; scrollRegion?: Locator; recordRegions?: readonly Locator[]; cue?: Locator }

export async function assertOverflowContract(input: OverflowContractInput): Promise<GeometryResult> {
  const { policy, owner, scrollRegion, recordRegions, cue } = input
  const ownerBox = await owner.boundingBox()
  if (policy === 'local-scroll') {
    if (!scrollRegion)
      return fail('overflow-contract', 'uncontained-local-overflow', 'local-scroll policy requires exactly one declared scroll region', 'one declared region', scrollRegion, {})
    const metrics = await measureRegion(scrollRegion)
    const regionBox = await scrollRegion.boundingBox()
    if (!isScrollable(metrics.overflowX))
      return fail('overflow-contract', 'uncontained-local-overflow', 'declared scroll region must permit horizontal scrolling', 'overflow-x auto or scroll', metrics.overflowX, { region: metrics, regionBox })
    if (regionBox && ownerBox && !withinOwner(regionBox, ownerBox))
      return fail('overflow-contract', 'surface-outside-owner', 'local scroll region escapes its declared owner', { left: ownerBox.x, right: ownerBox.x + ownerBox.width }, { left: regionBox.x, right: regionBox.x + regionBox.width }, { region: metrics, regionBox: toBox(regionBox) })
    const secondOwner = await scrollRegion.evaluate((el) => {
      for (let node = el.parentElement; node && node !== document.documentElement; node = node.parentElement) {
        const overflowX = getComputedStyle(node).overflowX
        if (node.scrollWidth > node.clientWidth + 1 && (overflowX === 'auto' || overflowX === 'scroll')) return true
      }
      return false
    })
    if (secondOwner)
      return fail('overflow-contract', 'uncontained-local-overflow', 'an ancestor outside the declared region is a second horizontal scroll owner', 'single scroll owner', true, { region: metrics })
    const cueVisible = cue ? await cue.isVisible() && (await cue.innerText()).trim().length > 0 : false
    if (metrics.overflowAmount > TOL && !cueVisible) return fail('overflow-contract', 'missing-scroll-discoverability', 'permitted local overflow lacks a visible discoverability cue', 'visible cue or associated description', cue ? 'invisible or empty cue' : 'no cue declared', { region: metrics })
    return pass('overflow-contract', { policy, region: metrics, regionBox, cueVisible, tolerancePx: TOL })
  }
  const regions = recordRegions ?? (scrollRegion ? [scrollRegion] : [])
  if (regions.length === 0)
    return fail('overflow-contract', 'unexpected-local-overflow', 'no-horizontal-scroll policy requires at least one record region', 'one or more record regions', regions.length, {})
  const measured: Record<string, RegionMetrics> = {}
  for (const [index, region] of regions.entries()) {
    const metrics = await measureRegion(region)
    measured[`regions[${index}]`] = metrics
    const regionBox = await region.boundingBox()
    if (regionBox && ownerBox && !withinOwner(regionBox, ownerBox)) return fail('overflow-contract', 'unexpected-local-overflow', `record region ${index} is wider than its owner; ancestor clipping must not create a pass`, ownerBox.x + ownerBox.width, regionBox.x + regionBox.width, { regions: measured, regionBox: toBox(regionBox), tolerancePx: TOL })
    if (metrics.overflowAmount > TOL) return fail('overflow-contract', 'unexpected-local-overflow', `record region ${index} overflows horizontally; clipping must not create a pass`, metrics.clientWidth, metrics.contentWidth, { regions: measured, tolerancePx: TOL })
  }
  return pass('overflow-contract', { policy, regions: measured, tolerancePx: TOL })
}

export interface LongDataToken { label: string; locator: Locator; critical?: boolean; disclosure?: Locator }

export async function assertLongDataContract(tokens: readonly LongDataToken[]): Promise<GeometryResult> {
  const tokenMeasurements: Record<string, unknown> = {}
  for (const token of tokens) {
    const metrics = await token.locator.evaluate((el) => {
      const style = getComputedStyle(el)
      return {
        scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
        whiteSpace: style.whiteSpace, overflowX: style.overflowX, textOverflow: style.textOverflow, overflowWrap: style.overflowWrap, text: (el.textContent ?? '').trim(),
      }
    })
    const rendered = metrics.clientWidth > 0 && metrics.clientHeight > 0 && metrics.text.length > 0
    const clipped = metrics.scrollWidth > metrics.clientWidth + TOL
    const disclosureVisible = token.disclosure ? await token.disclosure.isVisible() : false
    const reachable = isScrollable(metrics.overflowX) || disclosureVisible
    tokenMeasurements[token.label] = { ...metrics, rendered, clipped, reachable, disclosureVisible }
    if (token.critical && !rendered)
      return fail('long-data', 'long-data-clipping', `critical token ${token.label} is not rendered with measurable content`, 'positive geometry and non-empty text', metrics, { tokens: tokenMeasurements, tolerancePx: TOL })
    if (clipped && !reachable && token.critical)
      return fail('long-data', 'long-data-clipping', `critical token ${token.label} is clipped without scroll reachability or disclosure`, 'reachable or disclosed text', metrics, { tokens: tokenMeasurements, tolerancePx: TOL })
  }
  return pass('long-data', { tokens: tokenMeasurements, tolerancePx: TOL })
}

export async function measureScrollExtreme(region: Locator, extreme: ScrollExtreme): Promise<ScrollExtremeMeasurement> {
  return region.evaluate(async (el, side): Promise<ScrollExtremeMeasurement> => {
    const max = Math.max(0, el.scrollWidth - el.clientWidth)
    const requested = side === 'left' ? 0 : max
    el.scrollLeft = requested
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))))
    return { extreme: side, requested, actual: el.scrollLeft, max }
  }, extreme)
}

export interface EssentialElement { locator: Locator; expectedExtreme: ScrollExtreme | 'both' }

export async function assertEssentialReachabilityAtExtremes(region: Locator, essentials: Record<string, EssentialElement>): Promise<GeometryResult> {
  const extremes: Partial<Record<ScrollExtreme, ScrollExtremeMeasurement>> = {}
  const visibility: Record<string, Partial<Record<ScrollExtreme, boolean>>> = {}
  for (const side of ['left', 'right'] as const) {
    extremes[side] = await measureScrollExtreme(region, side)
    for (const [name, essential] of Object.entries(essentials)) (visibility[name] ??= {})[side] = await inViewport(essential.locator)
  }
  for (const [name, essential] of Object.entries(essentials)) {
    const sides: readonly ScrollExtreme[] = essential.expectedExtreme === 'both' ? ['left', 'right'] : [essential.expectedExtreme]
    if (!sides.every((side) => visibility[name][side])) return fail('scroll-extremes', 'essential-content-loss', `essential ${name} is not visible at its declared extreme`, essential.expectedExtreme, visibility[name], { extremes, visibility })
  }
  return pass('scroll-extremes', { extremes, visibility })
}

export interface PinnedPair { side: ScrollExtreme; header: Locator; body: Locator }
export interface StickyAlignmentInput { pinned?: readonly PinnedPair[]; stickyHeader?: Locator }

export async function assertStickyAndPinnedAlignment(region: Locator, input: StickyAlignmentInput): Promise<GeometryResult> {
  const alignments: Record<string, unknown>[] = []
  for (const pair of input.pinned ?? []) {
    await measureScrollExtreme(region, pair.side)
    const headerBox = await pair.header.boundingBox()
    const bodyBox = await pair.body.boundingBox()
        if (!headerBox || !bodyBox || headerBox.width <= 0 || headerBox.height <= 0 || bodyBox.width <= 0 || bodyBox.height <= 0)
          return fail('sticky-pinned-alignment', 'pinned-column-misalignment', 'pinned header or body cell box is missing or zero-sized', 'non-null positive boxes', { header: headerBox, body: bodyBox }, { alignments })
    const delta = Math.abs(headerBox.x - bodyBox.x) + Math.abs(headerBox.x + headerBox.width - (bodyBox.x + bodyBox.width))
    alignments.push({ side: pair.side, header: toBox(headerBox), body: toBox(bodyBox), edgeDelta: delta })
    if (delta > TOL) return fail('sticky-pinned-alignment', 'pinned-column-misalignment', 'pinned header and body cells diverge beyond the 1px tolerance', 0, delta, { alignments, tolerancePx: TOL })
  }
      if (input.stickyHeader) {
        const regionBox = await region.boundingBox()
        const header = await input.stickyHeader.elementHandle()
        const sticky = header ? await region.evaluate((region, header) => {
          for (let node: Element | null = header; node && node !== region; node = node.parentElement)
            if (getComputedStyle(node).position === 'sticky') return true
          return false
        }, header) : false
    await region.evaluate((el) => { el.scrollTop = el.scrollHeight })
    const headerBox = await input.stickyHeader.boundingBox()
    if (!regionBox || !headerBox || headerBox.width <= 0 || headerBox.height <= 0) return fail('sticky-pinned-alignment', 'sticky-header-misalignment', 'sticky header or scroll region box is missing or zero-sized', 'non-null positive boxes', { region: regionBox, header: headerBox }, {})
    const drift = Math.abs(headerBox.y - regionBox.y)
    if (!sticky || drift > TOL) return fail('sticky-pinned-alignment', 'sticky-header-misalignment', 'sticky header must use sticky positioning and stay at its region top boundary after vertical scroll', { position: 'sticky', top: regionBox.y }, { sticky, top: headerBox.y }, { regionTop: regionBox.y, headerTop: headerBox.y, drift, sticky, tolerancePx: TOL })
  }
  return pass('sticky-pinned-alignment', { alignments, stickyChecked: Boolean(input.stickyHeader), tolerancePx: TOL })
}
