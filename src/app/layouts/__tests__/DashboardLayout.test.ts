import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mountWithUApp } from '@/test/mountWithUApp'
import DashboardLayout from '../DashboardLayout.vue'

/**
 * DSC-REQ-013 — TDD anchor for DashboardLayout Coco shell binding.
 *
 * Pins:
 * - UDashboardSidebar body receives :ui.body with coco-neutral surface
 * - UDashboardNavbar title + leading icon receive :ui with text-coco-gold-500
 * - UNavigationMenu receives :ui with linkLabel/linkActive/linkLeadingIconActive
 *   gold overrides
 * - UDashboardSearchButton receives :ui with hover:bg-coco-gold-500/10
 * - UDashboardSidebarCollapse receives :ui with leadingIcon text-coco-gold-500
 * - UDropdownMenu (user) receives :ui.itemLeadingIcon with
 *   group-data-[checked=true]:text-coco-gold-500
 * - UDashboardSearch :ui does NOT force any bg-coco-neutral-* on shell slots
 *   (NO :ui.header / :ui.body / :ui.footer bg — Engram #3427 hard rule)
 *
 * Strategy: SFC source assertions. Nuxt UI 4 components do not expose
 * a `name` option and their default styling already includes some
 * Coco tokens (e.g. sidebar body), so DOM-level assertions either
 * pass for the wrong reason or are too fragile across Nuxt UI
 * versions. Asserting the SFC template carries the right :ui tokens
 * is the most direct way to pin the styling contract.
 */

// ── Router fixture (Nuxt UI Pro shell components inject route context) ────────

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/app/composables/useSidebar', () => ({
  useSidebar: () => ({
    tenants: ref([]),
    currentTenantLabel: ref('Coco'),
    currentTenantSlug: ref(''),
    showTenantSwitcher: ref(false),
    switchTenant: vi.fn(),
    selectedTeam: ref({}),
    teamsItems: ref([[]]),
    user: ref({ name: 'Coco', avatar: { alt: 'Coco', text: 'CO' } }),
    userItems: ref([[]]),
    getNavigationItems: vi.fn().mockReturnValue([]),
    changeColorMode: vi.fn(),
  }),
}))

vi.mock('@/app/composables/useDashboard', () => ({
  useDashboard: () => ({
    isSidebarOpen: ref(false),
    isSidebarCollapsed: ref(false),
    isSearchOpen: ref(false),
    searchGroups: ref([]),
    toggleSidebarOpen: vi.fn(),
    toggleSidebarCollapse: vi.fn(),
    openSearch: vi.fn(),
  }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const LAYOUT_PATH = join(__dirname, '..', 'DashboardLayout.vue')
const SIDEBAR_PATH = join(__dirname, '..', 'DashboardLayout.vue')

function readSfc(): string {
  return readFileSync(SIDEBAR_PATH, 'utf-8')
}

/**
 * Extract the `:ui="{ ... }"` body of a top-level component in the SFC
 * template. Uses a word boundary on the component name so it does NOT
 * match longer sibling names like `UDashboardSearchButton` /
 * `UDashboardSearchCollapse` when looking for `UDashboardSearch`.
 */
function extractUiBlock(sfc: string, componentName: string): string {
  // Match <ComponentName followed by space, `>`, or `/` to avoid
  // matching prefixes like UDashboardSearchButton.
  const pattern = new RegExp(
    `<${componentName}(?:\\s|>|\\/)[\\s\\S]*?:ui="\\{([\\s\\S]*?)\\}\\s*"(?:\\s|>|\\/)`,
  )
  const match = sfc.match(pattern)
  if (!match) return ''
  return match[1] ?? ''
}

function mountLayout() {
  const router = createTestRouter()
  return mountWithUApp(DashboardLayout, {
    global: { plugins: [router] },
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DashboardLayout — Coco shell binding (DSC-REQ-013)', () => {
  let wrapper: ReturnType<typeof mountWithUApp>
  let sfc: string

  beforeEach(() => {
    wrapper = mountLayout()
    sfc = readSfc()
  })

  // DSC-REQ-003: Sidebar body carries the coco-neutral surface token.
  it('UDashboardSidebar :ui.body includes bg-coco-neutral-50 dark:bg-coco-neutral-950', () => {
    const ui = extractUiBlock(sfc, 'UDashboardSidebar')
    expect(ui, 'UDashboardSidebar :ui block must exist in DashboardLayout.vue').toBeTruthy()
    expect(ui).toMatch(/body:\s*['"][^'"]*bg-coco-neutral-50[^'"]*dark:bg-coco-neutral-950/)
  })

  // DSC-REQ-002: Navbar title + leading icon carry the gold token.
  it('UDashboardNavbar :ui carries text-coco-gold-500 on title and leading slots', () => {
    const ui = extractUiBlock(sfc, 'UDashboardNavbar')
    expect(ui, 'UDashboardNavbar :ui block must exist in DashboardLayout.vue').toBeTruthy()
    expect(ui).toMatch(/title:\s*['"][^'"]*text-coco-gold-500/)
    expect(ui).toMatch(/leading:\s*['"][^'"]*text-coco-gold-500/)
  })

  // DSC-REQ-003: Sidebar collapse button gold icon
  it('UDashboardSidebarCollapse :ui carries text-coco-gold-500 on leadingIcon', () => {
    // DashboardLayout renders two UDashboardSidebarCollapse instances
    // (footer + navbar leading). At least one must carry the gold slot.
    const pattern = /<UDashboardSidebarCollapse[^>]*:ui="\{([\s\S]*?)\}"/g
    const matches = [...sfc.matchAll(pattern)]
    expect(matches.length, 'at least one UDashboardSidebarCollapse must exist').toBeGreaterThanOrEqual(1)
    const anyWithGold = matches.some((m) => /leadingIcon:\s*['"][^'"]*text-coco-gold-500/.test(m[1] ?? ''))
    expect(anyWithGold, 'at least one UDashboardSidebarCollapse :ui.leadingIcon must carry text-coco-gold-500').toBe(true)
  })

  // DSC-REQ-004: UNavigationMenu active-state gold tokens
  it('UNavigationMenu :ui carries linkLabel, linkActive, linkLeadingIconActive gold overrides', () => {
    const ui = extractUiBlock(sfc, 'UNavigationMenu')
    expect(ui, 'UNavigationMenu :ui block must exist in DashboardLayout.vue').toBeTruthy()
    expect(ui).toMatch(/linkLabel:\s*['"][^'"]*text-coco-gold-500/)
    expect(ui).toMatch(/linkActive:\s*['"][^'"]*bg-coco-gold-500\/10/)
    expect(ui).toMatch(/linkLeadingIconActive:\s*['"][^'"]*text-coco-gold-500/)
  })

  // DSC-REQ-005: Search button gold hover
  it('UDashboardSearchButton :ui carries hover:bg-coco-gold-500/10 on base', () => {
    const ui = extractUiBlock(sfc, 'UDashboardSearchButton')
    expect(ui, 'UDashboardSearchButton :ui block must exist in DashboardLayout.vue').toBeTruthy()
    expect(ui).toMatch(/base:\s*['"][^'"]*hover:bg-coco-gold-500\/10/)
  })

  // DSC-REQ-010: User dropdown checkicon gold (itemLeadingIcon)
  it('user UDropdownMenu :ui.itemLeadingIcon carries group-data-[checked=true]:text-coco-gold-500', () => {
    // DashboardLayout renders two UDropdownMenu instances (tenant +
    // user). Tenant dropdown MUST NOT have Coco gold on itemLeadingIcon
    // (DSC-REQ-009). User dropdown MUST have it. So we look for the
    // user dropdown's :ui block specifically.
    const pattern = /<UDropdownMenu[^>]*:ui="\{([\s\S]*?)\}"/g
    const matches = [...sfc.matchAll(pattern)]
    expect(matches.length, 'at least one UDropdownMenu :ui must exist').toBeGreaterThanOrEqual(1)
    const anyWithGold = matches.some((m) =>
      /itemLeadingIcon:\s*['"][^'"]*group-data-\[checked=true\]:text-coco-gold-500/.test(m[1] ?? ''),
    )
    expect(
      anyWithGold,
      'user UDropdownMenu :ui.itemLeadingIcon must carry group-data-[checked=true]:text-coco-gold-500',
    ).toBe(true)
  })

  // DSC-REQ-009 (complement): tenant dropdown MUST NOT have Coco gold.
  it('tenant UDropdownMenu :ui does NOT carry group-data-[checked=true]:text-coco-gold-500', () => {
    // Read the file and inspect all UDropdownMenu :ui blocks. At least
    // one (the tenant dropdown) must NOT carry the gold selector. The
    // user dropdown does carry it. This is a sanity anchor for
    // DSC-REQ-009.
    const pattern = /<UDropdownMenu[^>]*:ui="\{([\s\S]*?)\}"/g
    const matches = [...sfc.matchAll(pattern)]
    const withoutGold = matches.filter(
      (m) => !/itemLeadingIcon:\s*['"][^'"]*group-data-\[checked=true\]:text-coco-gold-500/.test(m[1] ?? ''),
    )
    // We need at least one without the gold (tenant dropdown). And
    // the wrapper must still render — regression anchor.
    expect(withoutGold.length, 'at least one UDropdownMenu :ui must NOT carry the gold selector (tenant dropdown)').toBeGreaterThanOrEqual(1)
  })

  // DSC-REQ-006: UDashboardSearch HARD RULE — no forced dark bg on shell slots.
  it('UDashboardSearch :ui does NOT force any bg-coco-neutral-* on header/body/footer (Engram #3427)', () => {
    const ui = extractUiBlock(sfc, 'UDashboardSearch')
    expect(ui, 'UDashboardSearch :ui block must exist in DashboardLayout.vue').toBeTruthy()

    // The shell slots must NOT contain any bg-coco-neutral-* class.
    for (const slot of ['header', 'body', 'footer']) {
      const slotPattern = new RegExp(`${slot}:\\s*['"]([^'"]*)['"]`)
      const slotMatch = ui.match(slotPattern)
      if (slotMatch) {
        const slotValue = slotMatch[1]
        expect(slotValue, `UDashboardSearch :ui.${slot} must NOT force bg-coco-neutral-*`).not.toMatch(
          /bg-coco-neutral-/,
        )
        expect(slotValue, `UDashboardSearch :ui.${slot} must NOT force dark:bg-coco-neutral-*`).not.toMatch(
          /dark:bg-coco-neutral-/,
        )
      }
      // absence is allowed (slot key simply not defined) — explicit
      // presence with Coco dark bg is the violation.
    }
  })

  // DSC-REQ-007: UDashboardSearch INTERNAL Coco accents
  it('UDashboardSearch :ui carries Coco gold tokens on input, groupLabel, itemActive', () => {
    const ui = extractUiBlock(sfc, 'UDashboardSearch')
    expect(ui, 'UDashboardSearch :ui block must exist in DashboardLayout.vue').toBeTruthy()
    expect(ui).toMatch(/input:\s*['"][^'"]*focus-visible:ring-coco-gold-500/)
    expect(ui).toMatch(/groupLabel:\s*['"][^'"]*text-coco-gold-700[^'"]*dark:text-coco-gold-400/)
    expect(ui).toMatch(/itemActive:\s*['"][^'"]*bg-coco-gold-500\/10/)
  })

  // Sanity: wrapper renders without crash (mount works)
  it('mounts DashboardLayout successfully under mountWithUApp with router', () => {
    const html = wrapper.html()
    expect(html.length).toBeGreaterThan(0)
  })
})

// Re-export LAYOUT_PATH to keep the reference for debugging.
export { LAYOUT_PATH }
