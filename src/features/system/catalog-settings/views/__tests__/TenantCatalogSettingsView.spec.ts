// TenantCatalogSettingsView.spec.ts — the routed Catálogo online screen in rows
// (artboard design/catalog-settings/01-ajustes-en-filas.html, S1 / S3 / S4).
//
// The view is mounted with the REAL form composable and the real section
// components; only the boundaries are mocked (read query, candidates query,
// mutation, permissions, tenant id, toast, ConfirmModal). Every rule is driven
// through the rendered controls, never through component instances.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { flushPromises, type DOMWrapper } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import TenantCatalogSettingsView from '@/features/system/catalog-settings/views/TenantCatalogSettingsView.vue'
import type { CatalogSettingsResponseDto } from '../../interfaces/catalog-settings.types'

// ── Boundaries ───────────────────────────────────────────────────────────────

const queryMock = {
  settings: ref<CatalogSettingsResponseDto | undefined>(undefined),
  isLoading: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refetch: vi.fn().mockResolvedValue({}),
}

vi.mock('../../composables/useCatalogSettingsQuery', () => ({
  useCatalogSettingsQuery: () => queryMock,
}))

const tenantId = ref('tenant-1')

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => tenantId,
}))

const permissionCodes = ref(new Set<string>())

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    userCan: (action: string, subject: string) =>
      permissionCodes.value.has(`${action}:${subject}`),
  }),
}))

const candidatesMock = {
  candidates: ref<Array<{ id: string; name: string }> | undefined>([]),
  isLoading: ref(false),
  isError: ref(false),
  refetch: vi.fn().mockResolvedValue({}),
}

vi.mock('../../composables/useCatalogPriceListCandidatesQuery', () => ({
  useCatalogPriceListCandidatesQuery: () => candidatesMock,
}))

const mutateAsyncMock = vi.fn()
const isPending = ref(false)

vi.mock('../../composables/useUpdateCatalogSettingsMutation', () => ({
  useUpdateCatalogSettingsMutation: () => ({ mutateAsync: mutateAsyncMock, isPending }),
}))

vi.mock('@/core/shared/components/ConfirmModal.vue', () => ({
  default: {
    name: 'ConfirmModal',
    props: ['open', 'title', 'description', 'confirmLabel', 'cancelLabel', 'loading', 'items'],
    emits: ['update:open', 'confirm', 'cancel'],
    template:
      '<div v-if="open" data-testid="confirm-modal"><h2 data-testid="confirm-title">{{ title }}</h2><p>{{ description }}</p><ul v-if="items"><li v-for="item in items" :key="item.id" data-testid="confirm-item">{{ item.title }}</li></ul><button data-testid="confirm-accept" @click="$emit(\'confirm\')">{{ confirmLabel }}</button><button data-testid="confirm-cancel" @click="$emit(\'cancel\')">Cancelar</button></div>',
  },
}))

const toastMock = { add: vi.fn() }

vi.mock('@nuxt/ui/runtime/composables/useToast', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useToast: () => toastMock }
})

// ── Fixtures ────────────────────────────────────────────────────────────────

const CANDIDATES = [
  { id: 'pl_pub', name: 'PUBLICO' },
  { id: 'pl_may', name: 'Mayoreo' },
  { id: 'pl_vet', name: 'Veterinarias' },
]

function makeResponse(
  overrides: Partial<CatalogSettingsResponseDto> = {},
): CatalogSettingsResponseDto {
  return {
    catalogPublished: true,
    catalogRequiresPublishedEditorial: false,
    effectivePublication: true,
    priceContexts: [
      { priceListId: 'pl_pub', name: 'PUBLICO', isCatalogDefault: true },
      { priceListId: 'pl_may', name: 'Mayoreo', isCatalogDefault: false },
    ],
    stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    warnings: [],
    updatedAt: '2026-11-04T15:05:00',
    ...overrides,
  }
}

const EDITOR = ['read:TenantCatalogSettings', 'update:TenantCatalogSettings', 'read:GlobalPriceList']

function grant(...codes: string[]) {
  permissionCodes.value = new Set(codes)
}

function mountEditor(response = makeResponse()) {
  queryMock.settings.value = response
  grant(...EDITOR)
  return mountWithUApp(TenantCatalogSettingsView, { attachTo: document.body })
}

type Wrapper = ReturnType<typeof mountEditor>

function row(wrapper: Wrapper, name: string): DOMWrapper<Element> {
  const found = wrapper
    .findAll('[data-testid="context-row"]')
    .find((candidate) => candidate.find('.cs-price-title').text().startsWith(name))
  if (!found) throw new Error(`row ${name} not found`)
  return found
}

const status = (wrapper: Wrapper) => wrapper.get('[data-testid="publication-status"]')
const saveStatus = (wrapper: Wrapper) => wrapper.get('[data-testid="save-status"]')
const saveButton = (wrapper: Wrapper) => wrapper.get('[data-testid="footer-save-button"]')

beforeEach(() => {
  queryMock.settings.value = undefined
  queryMock.isLoading.value = false
  queryMock.isError.value = false
  queryMock.refetch.mockClear()
  tenantId.value = 'tenant-1'
  candidatesMock.candidates.value = [...CANDIDATES]
  candidatesMock.isLoading.value = false
  candidatesMock.isError.value = false
  candidatesMock.refetch.mockClear()
  mutateAsyncMock.mockReset()
  isPending.value = false
  toastMock.add.mockReset()
  permissionCodes.value = new Set()
  document.body.innerHTML = ''
})

// ── Layout ──────────────────────────────────────────────────────────────────

describe('Catálogo online — layout (S1)', () => {
  it('shows the page header and the three sections in a centred column', () => {
    const wrapper = mountEditor()
    expect(wrapper.get('.hf-page-title').text()).toBe('Catálogo online')
    expect(wrapper.get('.hf-page-subtitle').text()).toBe(
      'Decide si tus clientes ven el catálogo, con qué precios y cómo se muestra el stock.',
    )
    expect(wrapper.classes()).toContain('cs-page')
    expect(wrapper.findAll('.cs-group-title').map((heading) => heading.text())).toEqual([
      'Publicación',
      'Precios que ve el público',
      'Stock en el catálogo',
    ])
  })

  it('lists price lists by name only, never by id', () => {
    const wrapper = mountEditor()
    const text = wrapper.get('[data-testid="contexts-card"]').text()
    expect(text).toContain('PUBLICO')
    expect(text).toContain('Veterinarias')
    expect(text).not.toMatch(/pl_/)
  })

  it('renders no classic checkbox anywhere on the screen (S3)', async () => {
    const wrapper = mountEditor(
      makeResponse({ stockPresentationDefault: { mode: 'CUSTOM_QUANTITY', customQuantity: 5 } }),
    )
    await nextTick()
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
    expect(wrapper.findAll('[role="checkbox"]')).toHaveLength(0)
    expect(document.querySelectorAll('input[type="checkbox"], [role="checkbox"]')).toHaveLength(0)
  })
})

// ── Publication ─────────────────────────────────────────────────────────────

describe('Catálogo online — publication row (S1)', () => {
  it('the whole row is the switch: one role="switch" carrying title and description', async () => {
    const wrapper = mountEditor()
    const toggle = wrapper.get('[data-testid="publish-switch"]')
    expect(toggle.element.tagName).toBe('BUTTON')
    expect(toggle.attributes('role')).toBe('switch')
    expect(toggle.attributes('aria-checked')).toBe('true')
    expect(toggle.text()).toContain('Catálogo publicado')
    expect(toggle.text()).toContain('Habilita la visibilidad del catálogo para clientes públicos.')

    // Clicking the description (part of the button) toggles it.
    await toggle.get('.cs-row-desc').trigger('click')
    expect(toggle.attributes('aria-checked')).toBe('false')
  })

  it('says visible with the list count and the default first', () => {
    const wrapper = mountEditor()
    expect(status(wrapper).attributes('data-tone')).toBe('success')
    expect(status(wrapper).text()).toContain(
      'Visible para el público · 2 listas de precios; se muestra primero PUBLICO.',
    )
    expect(status(wrapper).text()).not.toContain('Al guardar:')
  })

  it('says not visible with the server warning when the accepted state is not effective', () => {
    const wrapper = mountEditor(
      makeResponse({
        effectivePublication: false,
        warnings: ['DEFAULT_CONTEXT_HAS_NO_VALID_PRICES'],
      }),
    )
    expect(status(wrapper).attributes('data-tone')).toBe('warning')
    expect(status(wrapper).text()).toContain(
      'No visible: El contexto de catálogo por defecto no tiene precios válidos.',
    )
  })

  it('says not visible because publication is off, prefixed «Al guardar:» while dirty', async () => {
    const wrapper = mountEditor()
    await wrapper.get('[data-testid="publish-switch"]').trigger('click')
    expect(status(wrapper).attributes('data-tone')).toBe('muted')
    expect(status(wrapper).text()).toContain(
      'Al guardar: No visible: la publicación está desactivada.',
    )
  })
})

// ── Price lists ─────────────────────────────────────────────────────────────

describe('Catálogo online — public price lists (S1 / S4)', () => {
  it('counts public lists and marks the default row with a badge, a tint and a checked pill', () => {
    const wrapper = mountEditor()
    expect(wrapper.get('[data-testid="public-count"]').text()).toBe('2 de 3 públicas')

    const publico = row(wrapper, 'PUBLICO')
    expect(publico.attributes('data-default')).toBe('true')
    expect(publico.find('.hf-status-badge').text()).toBe('Predeterminada')
    expect(publico.get('[data-testid="default-radio"]').attributes('aria-checked')).toBe('true')

    // Only public rows offer the «Predeterminada» radio.
    expect(row(wrapper, 'Veterinarias').find('[data-testid="default-radio"]').exists()).toBe(false)
  })

  it('turning the default off moves it to the first other public list with a notice, and Deshacer restores it', async () => {
    const wrapper = mountEditor()
    await row(wrapper, 'PUBLICO').get('[data-testid="public-switch"]').trigger('click')

    expect(row(wrapper, 'Mayoreo').attributes('data-default')).toBe('true')
    expect(row(wrapper, 'PUBLICO').get('[data-testid="public-switch"]').attributes('aria-checked')).toBe('false')
    const notice = wrapper.get('[data-testid="default-move-notice"]')
    expect(notice.text()).toContain('Mayoreo ahora es la predeterminada porque PUBLICO dejó de ser pública.')

    await notice.get('[data-testid="undo-default-move"]').trigger('click')
    expect(row(wrapper, 'PUBLICO').attributes('data-default')).toBe('true')
    expect(wrapper.find('[data-testid="default-move-notice"]').exists()).toBe(false)
    // Back to the accepted snapshot: nothing left to save.
    expect(saveStatus(wrapper).text()).toBe('Sin cambios para guardar')
  })

  it('turning a list on when there is no default makes it the default', async () => {
    const wrapper = mountEditor(
      makeResponse({ catalogPublished: false, effectivePublication: false, priceContexts: [] }),
    )
    await row(wrapper, 'Veterinarias').get('[data-testid="public-switch"]').trigger('click')
    expect(row(wrapper, 'Veterinarias').attributes('data-default')).toBe('true')
  })

  it('with no public list shows the warning row and the status line follows', async () => {
    const wrapper = mountEditor(
      makeResponse({
        priceContexts: [{ priceListId: 'pl_pub', name: 'PUBLICO', isCatalogDefault: true }],
      }),
    )
    await row(wrapper, 'PUBLICO').get('[data-testid="public-switch"]').trigger('click')

    expect(wrapper.get('[data-testid="no-public-warning"]').text()).toContain(
      'Elige al menos una lista pública',
    )
    // REQ-9: clearing the last list clears publication intent as well.
    expect(wrapper.get('[data-testid="publish-switch"]').attributes('aria-checked')).toBe('false')
    expect(status(wrapper).text()).toContain('No visible:')
    expect(wrapper.find('[data-testid="default-move-notice"]').exists()).toBe(false)
  })

  it('choosing another default through the radio pill updates the badge and the status line', async () => {
    const wrapper = mountEditor()
    await row(wrapper, 'Mayoreo').get('[data-testid="default-radio"]').trigger('click')
    expect(row(wrapper, 'Mayoreo').find('.hf-status-badge').text()).toBe('Predeterminada')
    expect(status(wrapper).text()).toContain('Al guardar: Visible para el público')
    expect(status(wrapper).text()).toContain('se muestra primero Mayoreo.')
  })

  it('keeps the candidates loading state', () => {
    candidatesMock.isLoading.value = true
    const loading = mountEditor()
    expect(loading.get('[data-testid="contexts-loading"]').attributes('aria-busy')).toBe('true')
  })

  it('keeps the candidates error state, with a retry', async () => {
    candidatesMock.isError.value = true
    const failed = mountEditor()
    expect(failed.get('[data-testid="contexts-error"]').text()).toContain(
      'No se pudieron cargar las listas de precios',
    )
    await failed.get('[data-testid="contexts-retry"]').trigger('click')
    expect(candidatesMock.refetch).toHaveBeenCalledTimes(1)
  })

  it('locks the list controls without global-list read and keeps the accepted lists by name', async () => {
    candidatesMock.candidates.value = undefined
    queryMock.settings.value = makeResponse()
    grant('read:TenantCatalogSettings', 'update:TenantCatalogSettings')
    const wrapper = mountWithUApp(TenantCatalogSettingsView)

    expect(wrapper.find('[data-testid="contexts-disabled-note"]').exists()).toBe(true)
    const publico = row(wrapper, 'PUBLICO')
    expect(publico.get('[data-testid="public-switch"]').attributes('aria-disabled')).toBe('true')
    await publico.get('[data-testid="public-switch"]').trigger('click')
    expect(publico.get('[data-testid="public-switch"]').attributes('aria-checked')).toBe('true')
    // Publication and stock stay editable.
    expect(wrapper.get('[data-testid="publish-switch"]').attributes('aria-disabled')).toBeUndefined()
  })
})

// ── Stock ───────────────────────────────────────────────────────────────────

describe('Catálogo online — stock cards (S1)', () => {
  it('selecting «Mostrar cantidad fija» reveals «Cantidad a mostrar»; an invalid quantity blocks the save', async () => {
    const wrapper = mountEditor()
    const fixed = wrapper
      .findAll('[data-testid="stock-mode-radio"]')
      .find((card) => card.attributes('data-mode') === 'CUSTOM_QUANTITY')!
    await fixed.trigger('click')
    expect(fixed.attributes('aria-checked')).toBe('true')
    expect(wrapper.text()).toContain('Cantidad a mostrar')
    expect(saveButton(wrapper).attributes('disabled')).toBeUndefined()

    await wrapper.get('input[data-testid="stock-quantity-input"]').setValue('-3')
    expect(wrapper.get('[data-testid="stock-quantity"]').text()).toContain(
      'Escribe un número entero de 0 o más.',
    )
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    expect(saveStatus(wrapper).text()).toBe('Cambios sin guardar · revisa la cantidad')

    await wrapper.get('input[data-testid="stock-quantity-input"]').setValue('12')
    expect(saveButton(wrapper).attributes('disabled')).toBeUndefined()
  })
})

// ── Save bar ────────────────────────────────────────────────────────────────

describe('Catálogo online — save bar (S1 / S4)', () => {
  it('starts clean with Guardar disabled and the short «Actualizado» time', () => {
    const wrapper = mountEditor()
    expect(saveStatus(wrapper).text()).toBe('Sin cambios para guardar')
    expect(saveStatus(wrapper).attributes('data-state')).toBe('clean')
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="discard-button"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="updated-at"]').text()).toBe('Actualizado 4 nov, 15:05')
  })

  it('a change shows «Cambios sin guardar» with Descartar, which restores the accepted state', async () => {
    const wrapper = mountEditor()
    await wrapper.get('[data-testid="publish-switch"]').trigger('click')
    expect(saveStatus(wrapper).attributes('data-state')).toBe('dirty')
    expect(saveStatus(wrapper).text()).toBe('Cambios sin guardar')
    expect(saveButton(wrapper).attributes('disabled')).toBeUndefined()

    await wrapper.get('[data-testid="discard-button"]').trigger('click')
    expect(wrapper.get('[data-testid="publish-switch"]').attributes('aria-checked')).toBe('true')
    expect(saveStatus(wrapper).text()).toBe('Sin cambios para guardar')
  })

  it('saves one whitelisted PATCH, shows «Guardando…» then «Guardado» and the success toast', async () => {
    let resolve!: (value: CatalogSettingsResponseDto) => void
    mutateAsyncMock.mockImplementation(
      () =>
        new Promise((done) => {
          isPending.value = true
          resolve = (value) => {
            isPending.value = false
            done(value)
          }
        }),
    )
    const wrapper = mountEditor()
    await wrapper.get('[data-testid="publish-switch"]').trigger('click')
    await saveButton(wrapper).trigger('click')
    await nextTick()

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      body: { catalogPublished: false },
    })
    expect(saveStatus(wrapper).text()).toBe('Guardando…')

    resolve(makeResponse({ catalogPublished: false, effectivePublication: false }))
    await flushPromises()
    expect(saveStatus(wrapper).text()).toBe('Guardado')
    expect(toastMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Configuración de catálogo guardada' }),
    )
  })

  it('publishing (rising edge) asks for confirmation before any PATCH', async () => {
    mutateAsyncMock.mockResolvedValue(makeResponse())
    const wrapper = mountEditor(makeResponse({ catalogPublished: false, effectivePublication: false }))
    await wrapper.get('[data-testid="publish-switch"]').trigger('click')
    await saveButton(wrapper).trigger('click')
    expect(mutateAsyncMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('El catálogo será visible para clientes públicos. ¿Continuar?')

    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')
    await flushPromises()
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      body: { catalogPublished: true },
    })
  })

  it('a failed save keeps the draft dirty and shows the mapped error toast', async () => {
    mutateAsyncMock.mockRejectedValue({ response: { status: 403 } })
    const wrapper = mountEditor()
    await wrapper.get('[data-testid="publish-switch"]').trigger('click')
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(toastMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'No tienes permisos para guardar cambios' }),
    )
    expect(saveStatus(wrapper).text()).toBe('Cambios sin guardar')
  })
})

// ── Permissions and screen states ───────────────────────────────────────────

describe('Catálogo online — read-only and screen states (S4)', () => {
  it('without update permission shows the same rows read-only, with no switch, radio or save bar', () => {
    queryMock.settings.value = makeResponse()
    grant('read:TenantCatalogSettings')
    const wrapper = mountWithUApp(TenantCatalogSettingsView)

    expect(wrapper.find('[data-testid="catalog-settings-read"]').exists()).toBe(true)
    expect(wrapper.findAll('[role="switch"], [role="radio"], input')).toHaveLength(0)
    expect(wrapper.find('[data-testid="footer-save-button"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="readonly-notice"]').text()).toContain(
      'No tienes permisos para guardar cambios',
    )
    expect(wrapper.get('[data-testid="publication-badge"]').text()).toBe('Publicado')
  })

  it('shows a skeleton in the screen shape while loading', () => {
    queryMock.isLoading.value = true
    grant(...EDITOR)
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    const skeleton = wrapper.get('[data-testid="settings-loading"]')
    expect(skeleton.attributes('aria-busy')).toBe('true')
    expect(skeleton.findAll('[data-skeleton="section"]')).toHaveLength(3)
    expect(wrapper.find('[data-testid="settings-footer"]').exists()).toBe(false)
  })

  it('shows the error state with Reintentar and no synthetic defaults', async () => {
    queryMock.isError.value = true
    grant(...EDITOR)
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    const error = wrapper.get('[data-testid="settings-error"]')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain('No se pudo cargar la configuración del catálogo')
    expect(wrapper.find('[data-testid="catalog-settings-form"]').exists()).toBe(false)
    await wrapper.get('[data-testid="retry-button"]').trigger('click')
    expect(queryMock.refetch).toHaveBeenCalledTimes(1)
  })
})

// ── Published-only switch ───────────────────────────────────────────────────

const CHECKLIST = [
  'Publica primero las fichas de los productos que deben seguir en línea; los demás dejarán de verse.',
  'Vuelve a publicar las fichas guardadas antes de la versión actual: no cuentan como publicadas.',
  'Si agregaste variantes después de publicar, vuelve a publicar: hasta entonces no se ven.',
  'La búsqueda solo encontrará el título y la descripción publicados.',
  'El cambio puede tardar hasta 60 segundos en verse en el catálogo público.',
]

describe('Catálogo online — «solo fichas publicadas» (C3.3 S1)', () => {
  it('turning it on asks with the checklist before any PATCH, then sends only the key', async () => {
    mutateAsyncMock.mockResolvedValue(makeResponse({ catalogRequiresPublishedEditorial: true }))
    const wrapper = mountEditor()
    const toggle = wrapper.get('[data-testid="published-only-switch"]')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-checked')).toBe('true')
    expect(saveStatus(wrapper).text()).toBe('Cambios sin guardar')

    await saveButton(wrapper).trigger('click')
    expect(mutateAsyncMock).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="confirm-title"]').text()).toBe(
      'Antes de encender el interruptor',
    )
    expect(wrapper.findAll('[data-testid="confirm-item"]').map((item) => item.text())).toEqual(
      CHECKLIST,
    )
    expect(wrapper.get('[data-testid="confirm-accept"]').text()).toBe('Mostrar solo fichas publicadas')

    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')
    await flushPromises()
    expect(mutateAsyncMock).toHaveBeenCalledTimes(1)
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      body: { catalogRequiresPublishedEditorial: true },
    })
    expect(wrapper.find('[data-testid="confirm-modal"]').exists()).toBe(false)
    expect(saveStatus(wrapper).text()).toBe('Guardado')
  })

  it('Cancelar sends nothing and keeps the switch on in the draft', async () => {
    const wrapper = mountEditor()
    await wrapper.get('[data-testid="published-only-switch"]').trigger('click')
    await saveButton(wrapper).trigger('click')
    await wrapper.get('[data-testid="confirm-cancel"]').trigger('click')
    expect(mutateAsyncMock).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="confirm-modal"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="published-only-switch"]').attributes('aria-checked')).toBe('true')
    expect(saveStatus(wrapper).text()).toBe('Cambios sin guardar')
  })

  it('turning it off saves directly without confirmation', async () => {
    mutateAsyncMock.mockResolvedValue(makeResponse())
    const wrapper = mountEditor(makeResponse({ catalogRequiresPublishedEditorial: true }))
    await wrapper.get('[data-testid="published-only-switch"]').trigger('click')
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="confirm-modal"]').exists()).toBe(false)
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      body: { catalogRequiresPublishedEditorial: false },
    })
  })

  it('publishing and turning it on in one save asks once, covering both', async () => {
    mutateAsyncMock.mockResolvedValue(
      makeResponse({ catalogRequiresPublishedEditorial: true }),
    )
    const wrapper = mountEditor(makeResponse({ catalogPublished: false, effectivePublication: false }))
    await wrapper.get('[data-testid="publish-switch"]').trigger('click')
    await wrapper.get('[data-testid="published-only-switch"]').trigger('click')
    await saveButton(wrapper).trigger('click')
    expect(mutateAsyncMock).not.toHaveBeenCalled()
    expect(wrapper.findAll('[data-testid="confirm-modal"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="confirm-title"]').text()).toBe(
      'Antes de publicar y encender el interruptor',
    )
    expect(wrapper.findAll('[data-testid="confirm-item"]').map((item) => item.text())).toEqual([
      'El catálogo será visible para clientes públicos.',
      ...CHECKLIST,
    ])
    expect(wrapper.get('[data-testid="confirm-accept"]').text()).toBe('Publicar y mostrar solo fichas publicadas')

    await wrapper.get('[data-testid="confirm-accept"]').trigger('click')
    await flushPromises()
    expect(mutateAsyncMock).toHaveBeenCalledTimes(1)
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      body: { catalogPublished: true, catalogRequiresPublishedEditorial: true },
    })
  })

  it('without update permission shows the accepted value read-only, no switch', () => {
    queryMock.settings.value = makeResponse({ catalogRequiresPublishedEditorial: true })
    grant('read:TenantCatalogSettings')
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    expect(wrapper.find('[data-testid="published-only-switch"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="published-only-badge"]').text()).toBe('Activado')
  })
})
