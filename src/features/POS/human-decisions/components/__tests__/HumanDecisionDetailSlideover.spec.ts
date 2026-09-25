import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import HumanDecisionDetailSlideover from '../HumanDecisionDetailSlideover.vue'
import type {
  HumanDecision,
  PendingHumanDecision,
  ResolvedHumanDecision,
} from '../../interfaces/human-decision.types'
import type { HumanDecisionResolutionInput } from '../../utils/humanDecisionResolutionAttempt'

const AppResponsiveDrawerStub = {
  name: 'AppResponsiveDrawer',
  props: ['open', 'title', 'description', 'closeAriaLabel'],
  emits: ['update:open'],
  template: `
    <section data-testid="drawer-stub">
      <h1>{{ title }}</h1>
      <button data-testid="drawer-close" @click="$emit('update:open', false)">Cerrar</button>
      <slot name="body" />
    </section>
  `,
}
const UButtonStub = { template: '<button type="button"><slot /></button>' }
const ResolutionControlsStub = {
  name: 'HumanDecisionResolutionControls',
  emits: ['resolve'],
  template: `
    <button
      data-testid="stub-resolution"
      @click="$emit('resolve', { action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE', expectedVersion: 1 })"
    >Resolver</button>
  `,
}

function pending(overrides: Partial<PendingHumanDecision> = {}): PendingHumanDecision {
  return {
    id: 'decision-1',
    type: 'RESTOCK',
    title: '<b>Solicitud</b>',
    sanitizedSummary: '<img src=x onerror=alert(1)>',
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'PENDING',
    version: 1,
    resolution: null,
    allowedActions: ['PROVIDE_RESTOCK_ESTIMATE', 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE'],
    snapshot: {
      branchId: 'branch-1',
      branchName: null,
      productId: 'product-1',
      productName: 'Alimento 15 kg',
      variantId: 'variant-1',
      sku: null,
      requestedQuantity: null,
      observedStockAtRequest: 0,
      stockObservedAt: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  }
}

function resolved(resolution: ResolvedHumanDecision['resolution']): ResolvedHumanDecision {
  const base = pending()
  return {
    ...base,
    status: 'RESOLVED',
    version: 2,
    resolution,
    allowedActions: [],
  }
}

function mountDetail(
  decision: HumanDecision | null,
  options: {
    loading?: boolean
    error?: boolean
    canUpdate?: boolean
    onOpen?: (value: boolean) => void
    onResolve?: (input: HumanDecisionResolutionInput) => void
  } = {},
) {
  return mount(HumanDecisionDetailSlideover, {
    props: {
      open: true,
      decision,
      loading: options.loading,
      error: options.error,
      errorMessage: 'No se pudo cargar el detalle.',
      canUpdate: options.canUpdate,
      'onUpdate:open': options.onOpen,
      onResolve: options.onResolve,
    },
    global: {
      stubs: {
        AppResponsiveDrawer: AppResponsiveDrawerStub,
        UButton: UButtonStub,
        HumanDecisionResolutionControls: ResolutionControlsStub,
      },
    },
  })
}

describe('HumanDecisionDetailSlideover', () => {
  it('uses the responsive drawer and forwards its open model', async () => {
    const onOpen = vi.fn<(value: boolean) => void>()
    const wrapper = mountDetail(pending(), { onOpen })
    const drawer = wrapper.getComponent(AppResponsiveDrawerStub)
    expect(drawer.props()).toMatchObject({
      open: true,
      title: '<b>Solicitud</b>',
      description: 'Detalle de la solicitud de reposición.',
      closeAriaLabel: 'Cerrar detalle de decisión',
    })
    await wrapper.get('[data-testid="drawer-close"]').trigger('click')
    expect(onOpen).toHaveBeenCalledWith(false)
  })

  it('forwards an offline resolution input only when update is allowed', async () => {
    const onResolve = vi.fn<(input: HumanDecisionResolutionInput) => void>()
    const wrapper = mountDetail(pending(), { canUpdate: true, onResolve })
    await wrapper.get('[data-testid="stub-resolution"]').trigger('click')
    expect(onResolve).toHaveBeenCalledWith({
      action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
      expectedVersion: 1,
    })
    expect(mountDetail(pending()).find('[data-testid="stub-resolution"]').exists()).toBe(false)
  })

  it('renders distinct loading, error/retry, and no-selection states', async () => {
    expect(mountDetail(null, { loading: true }).get('[role="status"]').text()).toContain(
      'Cargando detalle',
    )

    const failed = mountDetail(null, { error: true })
    expect(failed.get('[role="alert"]').text()).toContain('No se pudo cargar el detalle.')
    await failed.get('[data-testid="human-decision-detail-retry"]').trigger('click')
    expect(failed.emitted('retry')).toHaveLength(1)

    expect(mountDetail(null).get('[role="status"]').text()).toContain('Selecciona una decisión')
  })

  it('renders the pending sanitized snapshot with honest fallbacks and literal text', () => {
    const unsafe = {
      ...pending(),
      sourceRequestId: 'bot-secret',
      applyBefore: 'provider-secret',
      rawTranscript: 'raw-secret',
    } as HumanDecision
    const wrapper = mountDetail(unsafe)
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<b>Solicitud</b>')
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
    expect(wrapper.text()).toContain('Pendiente')
    expect(wrapper.text()).toContain('Alimento 15 kg')
    expect(wrapper.text()).toContain('Sucursal no especificada')
    expect(wrapper.text()).toContain('Sin SKU')
    expect(wrapper.text()).toContain('Con variante')
    expect(wrapper.text()).toContain('Cantidad no especificada')
    expect(wrapper.text()).toContain('0 unidades')
    expect(wrapper.text()).not.toContain('bot-secret')
    expect(wrapper.text()).not.toContain('provider-secret')
    expect(wrapper.text()).not.toContain('raw-secret')
    expect(wrapper.text()).not.toMatch(/Resolver|Registrar respuesta/)
  })

  it('renders a resolved positive estimate without computing a calendar date', () => {
    const wrapper = mountDetail(
      resolved({
        action: 'PROVIDE_RESTOCK_ESTIMATE',
        restockDays: 8,
        resolvedAt: '2026-01-02T00:00:00.000Z',
        resolvedBy: { id: 'reviewer-1', displayName: 'María López' },
      }),
    )
    expect(wrapper.text()).toContain('Respondida')
    expect(wrapper.text()).toContain('Reposición estimada en 8 días naturales.')
    expect(wrapper.text()).toContain('María López')
    expect(wrapper.text()).not.toContain('09/01/2026')
    expect(wrapper.text()).not.toMatch(/entregad|stock actualiz/i)
  })

  it('renders the exact temporary-unavailability copy without a days claim', () => {
    const wrapper = mountDetail(
      resolved({
        action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
        resolvedAt: '2026-01-02T00:00:00.000Z',
        resolvedBy: { id: 'reviewer-1', displayName: 'María López' },
      }),
    )
    expect(wrapper.text()).toContain('Por ahora no tenemos una fecha estimada de reposición.')
    expect(wrapper.text()).not.toContain('días naturales')
  })
})
