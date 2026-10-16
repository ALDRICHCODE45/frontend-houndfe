import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick, type Ref } from 'vue'
import { enableAutoUnmount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mountWithUApp } from '@/test/mountWithUApp'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- vue-tsc resolves this SFC; the editor's plain TS language service cannot.
// @ts-ignore -- vue-tsc resolves this SFC; the editor's plain TS language service cannot.
import DashboardLayout from '../DashboardLayout.vue'
import { useSidebar } from '@/app/composables/useSidebar'
import { useDashboard } from '@/app/composables/useDashboard'

/**
 * Unified shell — DashboardLayout contract (odd/tasks/unified-shell-v0.md).
 *
 * This suite replaces the obsolete DSC-REQ-* Coco/gold source pins with
 * unified-shell contracts:
 *
 * - S1 palette/hooks: the shell exposes the 16 `hf-shell-*` hooks owned by
 *   the CSS unit and no longer hardcodes Coco/gold palette classes. The
 *   `hf-shell` root only scopes shell variables; routed content is untouched.
 * - S2/S4 native sizing: `UDashboardGroup unit="px"` + native
 *   `UDashboardSidebar` min/default/max/collapsed sizes drive the px rail
 *   (`--width`), with the pre-existing `local`/`hound-dashboard` persistence.
 *   Collapsed group destinations stay reachable through the native
 *   `UNavigationMenu` popover.
 * - S4 behavior preservation: breadcrumb, search, color-mode, tenant
 *   switching, account menu and the native mobile sidebar toggle.
 *
 * Strategy: rendered-DOM assertions where the installed @nuxt/ui components
 * produce observable output (`--width`, `data-collapsed`, aria-labels) plus
 * narrow SFC source assertions for props the DOM does not expose (min/max).
 * Source assertions are contracts, not rendered-fidelity proof (per L4).
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/app/composables/useSidebar', async () => {
  const { ref } = await vi.importActual<typeof import('vue')>('vue')

  const currentTenantLabel = ref('Sucursal Centro')
  const currentTenantSlug = ref('centro')
  const showTenantSwitcher = ref(true)
  const user = ref({ name: 'Ana Torres', avatar: { alt: 'Ana Torres', text: 'AT' } })
  const teamsItems = ref([[{ label: 'Sucursal Centro' }]])
  const userItems = ref([[{ label: 'Perfil' }]])
  const tenantShortcuts = ref({ 's-1': vi.fn(), 's-2': vi.fn() })

  const getNavigationItems = vi.fn(() => [
    {
      label: 'POS',
      icon: 'i-lucide-shopping-cart',
      // Mirrors the real `useSidebar` output after S6: every module group starts
      // closed even on an active child route.
      defaultOpen: false,
      children: [
        { label: 'Ventas', icon: 'i-lucide-shopping-cart', to: '/pos/ventas' },
        { label: 'Productos', icon: 'i-lucide-package', to: '/pos/products' },
      ],
    },
    { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/dashboard' },
  ])

  return {
    useSidebar: () => ({
      tenants: ref([]),
      currentTenantLabel,
      currentTenantSlug,
      showTenantSwitcher,
      switchTenant: vi.fn(),
      teamsItems,
      tenantShortcuts,
      user,
      userItems,
      getNavigationItems,
      changeColorMode: vi.fn(),
    }),
  }
})

vi.mock('@/app/composables/useDashboard', async () => {
  const { ref } = await vi.importActual<typeof import('vue')>('vue')

  const isSidebarOpen = ref(false)
  const isSidebarCollapsed = ref(false)
  const isSearchOpen = ref(false)
  const searchGroups = ref([])
  const openSearch = vi.fn()

  return {
    useDashboard: () => ({
      isSidebarOpen,
      isSidebarCollapsed,
      isSearchOpen,
      searchGroups,
      openSearch,
      toggleSidebarOpen: vi.fn(),
      toggleSidebarCollapse: vi.fn(),
    }),
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

// `mountWithUApp` returns a child wrapper, so `.unmount()` must be delegated to
// the test-utils auto-unmount hook rather than called directly.
enableAutoUnmount(afterEach)

// The composables are mocked with module-scoped refs shared across tests, so
// reset the shell state before every test to keep mounts independent.
beforeEach(() => {
  localStorage.clear()
  const dashboard = useDashboard()
  dashboard.isSidebarOpen.value = false
  dashboard.isSidebarCollapsed.value = false
  dashboard.isSearchOpen.value = false
  setTenantSwitcher(true)
})

// jsdom does not implement `scrollIntoView`, which the command palette calls
// when the shell search modal opens.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

const SFC_PATH = join(__dirname, '..', 'DashboardLayout.vue')
/** Key used by @nuxt/ui `useResizable` for `id="shell"` under storage-key "hound-dashboard". */
const SIDEBAR_STORAGE_KEY = 'hound-dashboard-sidebar-shell'

function readSfc(): string {
  return readFileSync(SFC_PATH, 'utf-8')
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
}

function mountLayout(initialPath = '/') {
  const router = createTestRouter()
  router.push(initialPath)
  return mountWithUApp(DashboardLayout, {
    global: { plugins: [router] },
  })
}

async function mountLayoutAt(initialPath: string) {
  const router = createTestRouter()
  await router.push(initialPath)
  await router.isReady()
  return mountWithUApp(DashboardLayout, {
    global: { plugins: [router] },
  })
}

/** Locate a navigation group trigger by its visible label. */
function findNavTrigger(wrapper: ReturnType<typeof mountWithUApp>, label: string) {
  return wrapper
    .findAll('.hf-shell-nav [data-slot="link"]')
    .find((link) => link.text().includes(label))
}

/** Native accordion state of the list item that owns a group trigger. */
function navGroupState(wrapper: ReturnType<typeof mountWithUApp>, label: string) {
  return findNavTrigger(wrapper, label)
    ?.element.closest('li[data-slot="item"]')
    ?.getAttribute('data-state')
}

/** Toggle a closed group open through the installed Accordion trigger. */
async function openNavGroup(wrapper: ReturnType<typeof mountWithUApp>, label: string) {
  const trigger = findNavTrigger(wrapper, label)
  if (!trigger) throw new Error(`navigation group "${label}" not found`)
  await trigger.trigger('click')
  await nextTick()
}

/**
 * The real `useSidebar` exposes `showTenantSwitcher` as a readonly computed;
 * the test mock supplies a writable ref so single-tenant rendering is testable.
 */
function setTenantSwitcher(value: boolean) {
  ;(useSidebar().showTenantSwitcher as Ref<boolean>).value = value
}

/**
 * Hooks owned by the CSS unit and rendered by the shell.
 *
 * `hf-shell-panel` (elevated card) is intentionally excluded: the routed views
 * own their content panels, so the shell does not wrap `<slot />` (S3 "no
 * page-content redesign"). The workspace hook paints the page plane on the
 * panel body instead.
 */
const SHELL_HOOKS = [
  'hf-shell',
  'hf-shell-sidebar',
  'hf-shell-brand',
  'hf-shell-brand-logo',
  'hf-shell-tenant',
  'hf-shell-search',
  'hf-shell-nav',
  'hf-shell-footer',
  'hf-shell-user',
  'hf-shell-navbar',
  'hf-shell-breadcrumb',
  'hf-shell-actions',
  'hf-shell-workspace',
  'hf-shell-portal',
  'hf-shell-nav-portal',
] as const

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DashboardLayout — unified shell hooks and scoped palette (S1–S3)', () => {
  let wrapper: ReturnType<typeof mountWithUApp>

  beforeEach(() => {
    localStorage.clear()
    wrapper = mountLayout()
  })

  it('imports the CSS-unit stylesheet that owns the shell palette', () => {
    const sfc = readSfc()
    expect(sfc).toMatch(/import\s+['"]\.\/styles\/unified-shell\.css['"]/)
  })

  it('does not hardcode obsolete Coco/gold palette classes in the shell', () => {
    const sfc = readSfc()
    expect(sfc).not.toMatch(/coco-gold/)
    expect(sfc).not.toMatch(/coco-neutral/)
    expect(sfc).not.toMatch(/coco-navy/)
  })

  it.each(SHELL_HOOKS)('source declares the %s hook', (hook) => {
    expect(readSfc()).toContain(hook)
  })

  it.each([
    'hf-shell',
    'hf-shell-sidebar',
    'hf-shell-brand',
    'hf-shell-brand-logo',
    'hf-shell-tenant',
    'hf-shell-search',
    'hf-shell-nav',
    'hf-shell-footer',
    'hf-shell-user',
    'hf-shell-navbar',
    'hf-shell-breadcrumb',
    'hf-shell-actions',
    'hf-shell-workspace',
  ])('renders the %s hook element in the live shell', (hook) => {
    expect(wrapper.find(`.${hook}`).exists(), `.${hook} must render`).toBe(true)
  })

  it('scopes portal surfaces (dropdown + search) with hf-shell-portal', () => {
    const sfc = readSfc()
    const matches = sfc.match(/hf-shell-portal/g) ?? []
    // tenant dropdown, footer user dropdown, navbar account menu, drawer and
    // the global search modal.
    expect(matches.length).toBeGreaterThanOrEqual(3)
    expect(sfc).toMatch(/<(?:UDropdownMenu|UDashboardSearch)[^>]*hf-shell-portal/)
  })

  it('scopes shell variables from the root without styling routed content globally', () => {
    const sfc = readSfc()
    // The root owns `hf-shell`; the layout must not introduce a global
    // `hf-ui` override across routed pages.
    expect(sfc).toMatch(/<UDashboardGroup[\s\S]*?class="[^"]*hf-shell/)
    expect(sfc).not.toMatch(/hf-ui/)
  })
})

describe('DashboardLayout — real login brand asset (S7)', () => {
  let wrapper: ReturnType<typeof mountWithUApp>

  beforeEach(() => {
    localStorage.clear()
    wrapper = mountLayout()
  })

  it('renders the actual login logo instead of the text imitation', () => {
    const logo = wrapper.find('img.hf-shell-brand-logo')
    expect(logo.exists()).toBe(true)
    expect(logo.attributes('src')).toBe('/hounfeLogos/primary.png')
    expect(logo.attributes('alt')).toBe('HounFe')
  })

  it('drops the artificial h/f wordmark markup from the brand row', () => {
    const sfc = readSfc()
    expect(sfc).not.toMatch(/hf-shell-brand-mark/)
    expect(sfc).not.toMatch(/hf-shell-brand-name/)
  })

  it('keeps the logo inside the brand row on the compact rail with a real alt', async () => {
    localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      JSON.stringify({ size: 256, collapsed: true }),
    )
    const compact = mountLayout()
    await nextTick()

    const logo = compact.find(
      '.hf-shell-sidebar[data-collapsed="true"] .hf-shell-brand img.hf-shell-brand-logo',
    )
    expect(logo.exists()).toBe(true)
    expect(logo.attributes('src')).toBe('/hounfeLogos/primary.png')
    expect((logo.attributes('alt') ?? '').trim().length).toBeGreaterThan(0)
  })
})

describe('DashboardLayout — native px sizing and persistence (S2/S4)', () => {
  let wrapper: ReturnType<typeof mountWithUApp>

  beforeEach(() => {
    localStorage.clear()
  })

  it('uses the native px unit with min/default/max/collapsed sizes', () => {
    const sfc = readSfc()
    const groupTag = sfc.match(/<UDashboardGroup\b[\s\S]*?>/)![0]
    expect(groupTag).toMatch(/unit="px"/)
    expect(groupTag).toMatch(/storage="local"/)
    expect(groupTag).toMatch(/storage-key="hound-dashboard"/)

    const sidebarTag = sfc.match(/<UDashboardSidebar\b[\s\S]*?>/)![0]
    expect(sidebarTag).toMatch(/:min-size="232"/)
    expect(sidebarTag).toMatch(/:default-size="256"/)
    expect(sidebarTag).toMatch(/:max-size="320"/)
    expect(sidebarTag).toMatch(/:collapsed-size="76"/)
    expect(sidebarTag).toMatch(/\bresizable\b/)
    expect(sidebarTag).toMatch(/\bcollapsible\b/)
  })

  it('renders the native 256px default rail width', () => {
    wrapper = mountLayout()
    const style = wrapper.find('.hf-shell-sidebar').attributes('style') ?? ''
    expect(style).toContain('--width: 256px')
  })

  it('renders the native 76px collapsed rail width from persisted state', async () => {
    localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      JSON.stringify({ size: 256, collapsed: true }),
    )
    wrapper = mountLayout()
    await nextTick()
    expect(wrapper.find('.hf-shell-sidebar').attributes('data-collapsed')).toBe('true')
    const style = wrapper.find('.hf-shell-sidebar').attributes('style') ?? ''
    expect(style).toContain('--width: 76px')
  })

  it('keeps the existing collapse toggle wired to the native collapse control', () => {
    wrapper = mountLayout()
    expect(wrapper.find('button[aria-label="Collapse sidebar"]').exists()).toBe(true)
  })
})

describe('DashboardLayout — collapsed rail reachability (S2/S4)', () => {
  let wrapper: ReturnType<typeof mountWithUApp>

  beforeEach(() => {
    localStorage.clear()
    useDashboard().isSidebarOpen.value = false
  })

  it('drives collapsed navigation through the native popover so groups stay reachable', () => {
    const sfc = readSfc()
    const navTag = sfc.match(/<UNavigationMenu\b[\s\S]*?\/?>/)![0]
    expect(navTag).toMatch(/:collapsed="collapsed"/)
    expect(navTag).toMatch(/\bpopover\b/)
    // The active-class decoration is derived from the live route before the
    // items reach the installed NavigationMenu.
    expect(navTag).toMatch(/:items="navigationFor\(collapsed\)"/)
  })

  it('forwards the shell portal markers into the real installed compact popover content', async () => {
    localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      JSON.stringify({ size: 256, collapsed: true }),
    )
    wrapper = mountLayout()
    await nextTick()

    // Collapsed group destinations open a teleported NavigationMenu popover.
    // Focusing its trigger proves the `ui.content` markers reach the installed
    // popover surface instead of only living in the SFC source.
    await wrapper.get('.hf-shell-nav [data-slot="link"]').trigger('focus')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await nextTick()

    const portalContent = document.body.querySelector<HTMLElement>(
      '[data-slot="content"].hf-shell-nav-portal',
    )
    expect(
      portalContent,
      'the installed compact popover content must carry the nav portal hook',
    ).not.toBeNull()
    expect(portalContent!.classList.contains('hf-shell-portal')).toBe(true)
    // The popover leaves the shell root, so the marker (not an ancestor) is
    // what repeats the shell palette on the teleported surface.
    expect(document.querySelector('.hf-shell [data-slot="content"].hf-shell-nav-portal')).toBeNull()
  })

  it('marks the active rail destination, including child links', async () => {
    const active = await mountLayoutAt('/pos/ventas')

    // S6: groups start closed, so the child link only exists once the user
    // expands the group. Active styling still reaches both levels.
    await openNavGroup(active, 'POS')

    // Vertical child links render through the installed NavigationMenu `link`
    // slot (the `childLink` slot is reserved for collapsed popovers), so the
    // child anchor carries the class plus aria-current.
    const childLink = active.find('a[href="/pos/ventas"].hf-shell-nav-active')
    expect(childLink.exists()).toBe(true)
    expect(childLink.text()).toContain('Ventas')
    expect(childLink.attributes('aria-current')).toBe('page')
    // Group heading is marked active too.
    expect(active.findAll('.hf-shell-nav-active').length).toBeGreaterThanOrEqual(2)
  })

  it('marks the current breadcrumb item with the shell current hook', async () => {
    const active = await mountLayoutAt('/pos/ventas')
    const current = active.find('.hf-shell-breadcrumb-current')
    expect(current.exists()).toBe(true)
    expect(current.text()).toContain('Ventas')
    expect(current.attributes('aria-current')).toBe('page')
  })

  it('keeps the mobile drawer expanded even when the desktop rail is collapsed', async () => {
    localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      JSON.stringify({ size: 256, collapsed: true }),
    )
    useDashboard().isSidebarOpen.value = true

    wrapper = mountLayout()
    await nextTick()

    expect(wrapper.find('.hf-shell-sidebar').attributes('data-collapsed')).toBe('true')

    const drawer = document.body.querySelector('[data-hf-shell-drawer]')
    expect(drawer, 'mobile drawer must render when open').not.toBeNull()
    const drawerNav = drawer!.querySelector('[data-collapsed]')
    expect(
      drawerNav?.getAttribute('data-collapsed'),
      'drawer navigation must not inherit the collapsed rail state',
    ).toBe('false')

    useDashboard().isSidebarOpen.value = false
  })
})

describe('DashboardLayout — module groups start closed and stay user-toggleable (S6)', () => {
  beforeEach(() => {
    localStorage.clear()
    useDashboard().isSidebarOpen.value = false
  })

  it('mounts the active Products route with the POS group closed', async () => {
    const wrapper = await mountLayoutAt('/pos/products')

    expect(navGroupState(wrapper, 'POS')).toBe('closed')

    // Route-active styling must mark the heading without forcing it open.
    const trigger = findNavTrigger(wrapper, 'POS')
    expect(trigger?.classes()).toContain('hf-shell-nav-active')
    expect(wrapper.find('a[href="/pos/products"]').exists()).toBe(false)
  })

  it('opens a closed group on click and collapses it again', async () => {
    const wrapper = await mountLayoutAt('/pos/products')

    expect(navGroupState(wrapper, 'POS')).toBe('closed')

    await openNavGroup(wrapper, 'POS')
    expect(navGroupState(wrapper, 'POS')).toBe('open')
    expect(wrapper.find('a[href="/pos/products"]').exists()).toBe(true)

    await openNavGroup(wrapper, 'POS')
    expect(navGroupState(wrapper, 'POS')).toBe('closed')
  })
})

describe('DashboardLayout — preserved shell behavior (S4)', () => {
  let wrapper: ReturnType<typeof mountWithUApp>

  beforeEach(() => {
    localStorage.clear()
    useDashboard().isSidebarOpen.value = false
    setTenantSwitcher(true)
    wrapper = mountLayout()
  })

  it('mounts successfully under mountWithUApp with router', () => {
    expect(wrapper.html().length).toBeGreaterThan(0)
  })

  it('renders the breadcrumb with an accessible nav landmark', () => {
    expect(wrapper.find('nav[aria-label="breadcrumb"]').exists()).toBe(true)
    expect(wrapper.find('.hf-shell-breadcrumb').text()).toContain('Dashboard')
  })

  it('wires the navbar search action to the existing openSearch behavior', async () => {
    const openSearch = useDashboard().openSearch
    const search = wrapper.find('button[aria-label="Buscar"]')
    expect(search.exists()).toBe(true)
    await search.trigger('click')
    expect(openSearch).toHaveBeenCalled()
  })

  it('opens the shared dashboard search from the shell search trigger', async () => {
    const trigger = wrapper.find('.hf-shell-search')
    expect(trigger.exists()).toBe(true)
    await trigger.trigger('click')
    expect(useDashboard().isSearchOpen.value).toBe(true)
  })

  it('keeps the color-mode toggle in the navbar actions', () => {
    expect(
      wrapper.find('.hf-shell-actions button[aria-label^="Switch to"]').exists(),
    ).toBe(true)
  })

  it('renders the tenant card with actual tenant data and the switcher', () => {
    expect(
      wrapper.find('button[aria-label="Seleccionar sucursal: Sucursal Centro"]').exists(),
    ).toBe(true)
    expect(wrapper.find('.hf-shell-tenant').text()).toContain('Sucursal Centro')
  })

  it('falls back to a non-interactive tenant label for single-tenant users', async () => {
    setTenantSwitcher(false)
    await nextTick()
    expect(
      wrapper.find('button[aria-label="Seleccionar sucursal: Sucursal Centro"]').exists(),
    ).toBe(false)
    expect(wrapper.find('.hf-shell-tenant').text()).toContain('Sucursal Centro')
  })

  it('renders the account menu avatar in the navbar actions', () => {
    expect(wrapper.find('.hf-shell-actions [aria-label="Abrir menú de usuario"]').exists()).toBe(
      true,
    )
  })

  it('keeps the footer user trigger with the account menu', () => {
    expect(wrapper.find('.hf-shell-footer .hf-shell-user').exists()).toBe(true)
    expect(wrapper.find('.hf-shell-user').attributes('aria-label')).toBe('Abrir menú de usuario')
  })

  it('passes the live collapsed flag into the navigation composable', () => {
    expect(useSidebar().getNavigationItems).toHaveBeenCalledWith(false)
  })
})

// ──────────────────────────────────────────────────────────────────────
// Native mobile sidebar trigger (ASNT-REQ-001/002/003) — preserved.
// The user-facing fix keeps the installed @nuxt/ui native
// UDashboardSidebarToggle in the navbar leading slot while the separate
// desktop UDashboardSidebarCollapse stays in the same slot.
// ──────────────────────────────────────────────────────────────────────

describe('DashboardLayout — mobile sidebar trigger (ASNT-REQ-001/002/003)', () => {
  let wrapper: ReturnType<typeof mountWithUApp>

  beforeEach(() => {
    localStorage.clear()
    useDashboard().isSidebarOpen.value = false
    wrapper = mountLayout()
  })

  it('does not suppress the native sidebar toggle', () => {
    const navbarTag = readSfc().match(/<UDashboardNavbar\b[\s\S]*?>/)![0]
    expect(navbarTag).not.toMatch(/:toggle="false"/)
  })

  it('renders the native toggle with a 44x44 target before the breadcrumb', () => {
    const nativeToggle = wrapper.find('button[aria-label="Open sidebar"]')
    expect(nativeToggle.exists()).toBe(true)
    expect(nativeToggle.classes()).toContain('size-11')

    const breadcrumb = wrapper.find('nav[aria-label="breadcrumb"]')
    expect(breadcrumb.exists()).toBe(true)
    const position = nativeToggle.element.compareDocumentPosition(breadcrumb.element)
    expect(Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
  })

  it('keeps the desktop collapse control in the navbar leading slot', () => {
    const leftSlot = readSfc().match(/<template #left>[\s\S]*?<\/template>/)![0]
    expect(leftSlot).toMatch(/UDashboardSidebarCollapse/)
    expect(wrapper.find('button[aria-label="Collapse sidebar"]').exists()).toBe(true)
  })
})

// ──────────────────────────────────────────────────────────────────────
// Branch shortcuts and inert navbar controls (feat/shell-chrome-polish).
describe('DashboardLayout — branch shortcuts and navbar actions', () => {
  let wrapper: ReturnType<typeof mountWithUApp>

  /** The registry exposes `s-N` handlers; the layout registers them as-is. */
  function shortcut(key: 's-1' | 's-2') {
    return (useSidebar() as unknown as { tenantShortcuts: Ref<Record<string, () => void>> })
      .tenantShortcuts.value[key] as ReturnType<typeof vi.fn>
  }

  /** One keydown per key from the focused element, bubbling up to `window`. */
  async function press(...keys: string[]) {
    for (const key of keys) {
      ;(document.activeElement ?? document.body).dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true }),
      )
    }
    await nextTick()
  }

  beforeEach(() => {
    localStorage.clear()
    setTenantSwitcher(true)
    shortcut('s-1').mockClear()
    shortcut('s-2').mockClear()
    wrapper = mountLayout()
  })

  it('switches branch with S then the list number', async () => {
    await press('s', '2')

    expect(shortcut('s-2')).toHaveBeenCalledOnce()
    expect(shortcut('s-1')).not.toHaveBeenCalled()
  })

  it('does not switch branch while typing in a field', async () => {
    const field = document.createElement('input')
    document.body.append(field)
    field.focus()
    try {
      await press('s', '1')
      expect(shortcut('s-1')).not.toHaveBeenCalled()
    } finally {
      field.remove()
    }
  })

  it('keeps the existing O shortcut that collapses the rail', async () => {
    await press('o')

    expect(useDashboard().isSidebarCollapsed.value).toBe(true)
  })

  it('hides the notifications bell, which had no action', () => {
    expect(wrapper.find('button[aria-label="Notificaciones"]').exists()).toBe(false)
    expect(wrapper.find('.hf-shell-actions button[aria-label="Buscar"]').exists()).toBe(true)
  })
})

// ──────────────────────────────────────────────────────────────────────
// Chrome control hooks (feat/shell-chrome-polish): every navbar/sidebar
// control carries the hook whose shell paint the stylesheet contracts pin.
describe('DashboardLayout — chrome control hooks', () => {
  let wrapper: ReturnType<typeof mountWithUApp>

  beforeEach(() => {
    localStorage.clear()
    setTenantSwitcher(true)
    wrapper = mountLayout()
  })

  it('paints the navbar search and color-mode buttons as shell icon buttons', () => {
    expect(wrapper.find('.hf-shell-actions button[aria-label="Buscar"]').classes()).toContain(
      'hf-shell-icon-button',
    )
    expect(
      wrapper.find('.hf-shell-actions button[aria-label^="Switch to"]').classes(),
    ).toContain('hf-shell-icon-button')
  })

  it('paints both sidebar collapse toggles as shell icon buttons', () => {
    const toggles = wrapper.findAll('button[aria-label="Collapse sidebar"]')
    expect(toggles).toHaveLength(2)
    for (const toggle of toggles) expect(toggle.classes()).toContain('hf-shell-icon-button')
  })

  it('rings the navbar account avatar', () => {
    expect(
      wrapper.find('.hf-shell-actions [aria-label="Abrir menú de usuario"]').classes(),
    ).toContain('hf-shell-avatar-button')
  })

  it('shows the branch initial as a tile, in the switcher and the single-branch label', async () => {
    expect(wrapper.find('button.hf-shell-tenant .hf-shell-tenant-tile').text()).toBe('S')

    setTenantSwitcher(false)
    await nextTick()
    expect(wrapper.find('div.hf-shell-tenant .hf-shell-tenant-tile').text()).toBe('S')
  })

  it('uses the first letter for the tile, so the global scope reads G, not "("', async () => {
    const label = useSidebar().currentTenantLabel as Ref<string>
    label.value = '(Global)'
    try {
      await nextTick()
      expect(wrapper.find('.hf-shell-tenant-tile').text()).toBe('G')
    } finally {
      label.value = 'Sucursal Centro'
    }
  })

  it('marks the branch and account menus with the shell menu boundaries', () => {
    const sfc = readSfc()
    expect(sfc).toContain("content: 'hf-shell-portal hf-shell-menu hf-shell-tenant-menu'")
    expect(sfc.match(/content: 'min-w-48 hf-shell-portal hf-shell-menu'/g)).toHaveLength(2)
  })
})
