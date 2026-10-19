import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { ref } from 'vue'
import PromotionForm from '../PromotionForm.vue'
import { promotionApi } from '../../api/promotion.api'
import { promotionQueryKeys } from '@/core/shared/constants/query-keys'
import { botPromotion, botRule } from '../../utils/__tests__/botEligibility.fixtures'
import type { BotEligibilityRule, PromotionFormState } from '../../interfaces/promotion.types'

const tenant = ref('tenant-a')
vi.mock('@/features/auth/composables/useSafeTenantId', () => ({ useSafeTenantId: () => tenant }))
vi.mock('../../api/promotion.api', () => ({
  promotionApi: { getBotEligibilityCapabilities: vi.fn() },
}))
vi.mock('../../composables/usePromotionTargetNames', () => ({
  usePromotionTargetNames: () => ({ resolveTargetNames: vi.fn() }),
}))

const Switch = {
  props: ['modelValue', 'disabled', 'label'],
  emits: ['update:modelValue'],
  template:
    '<label>{{ label }}<input role="switch" type="checkbox" :checked="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.checked)" /></label>',
}
const stubs = {
  UCard: { template: '<div><slot name="header" /><slot /></div>' },
  UForm: {
    props: ['state', 'errors'],
    emits: ['submit'],
    template: '<form @submit.prevent="$emit(\'submit\')"><slot /></form>',
  },
  UFormField: {
    props: ['name', 'label', 'description'],
    template: '<div :data-field="name">{{ label }}<slot />{{ description }}</div>',
  },
  USwitch: Switch,
  Switch,
  UInput: true,
  UInputNumber: true,
  USelect: true,
  UIcon: true,
  UButton: true,
  PromotionCapacityField: true,
  PromotionSummaryCard: true,
  PromotionConditionsSection: {
    name: 'PromotionConditionsSection',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div />',
  },
  PromotionTargetItemsSection: {
    name: 'PromotionTargetItemsSection',
    emits: ['update:targetType'],
    template: '<div />',
  },
}
const mounted: { wrapper: { unmount: () => void }; queryClient: QueryClient }[] = []
afterEach(() => {
  for (const { wrapper, queryClient } of mounted) {
    wrapper.unmount()
    queryClient.clear()
  }
  mounted.length = 0
})
function mountForm({
  mode = 'edit',
  rules = [botRule],
  pending = false,
}: { mode?: 'edit' | 'create'; rules?: BotEligibilityRule[]; pending?: boolean } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (!pending)
    queryClient.setQueryData(promotionQueryKeys.botEligibilityCapabilities(tenant.value), { rules })
  const wrapper = mount(PromotionForm, {
    props: { type: 'PRODUCT_DISCOUNT', mode, initialData: mode === 'edit' ? botPromotion() : null },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: { ...stubs, Form: stubs.UForm, FormField: stubs.UFormField, Button: true },
    },
  })
  mounted.push({ wrapper, queryClient })
  return { wrapper, queryClient }
}
const botSwitch = (wrapper: ReturnType<typeof mountForm>['wrapper']) =>
  wrapper.get('input[role="switch"]')
async function submitted(wrapper: ReturnType<typeof mountForm>['wrapper']) {
  await wrapper.get('form').trigger('submit')
  const events = wrapper.emitted('submit')!
  return events[events.length - 1]![0] as PromotionFormState
}

beforeEach(() => {
  tenant.value = 'tenant-a'
  vi.mocked(promotionApi.getBotEligibilityCapabilities).mockReset()
  vi.mocked(promotionApi.getBotEligibilityCapabilities).mockImplementation(
    () => new Promise(() => {}),
  )
})

describe('PromotionForm WhatsApp switch', () => {
  it.each(['create', 'edit'] as const)(
    'enables matching combinations in %s and submits the selection',
    async (mode) => {
      const { wrapper } = mountForm({ mode })
      expect(wrapper.text()).toContain('Disponible para el chatbot (WhatsApp)')
      expect(botSwitch(wrapper).attributes('disabled')).toBeUndefined()
      await botSwitch(wrapper).setValue(true)
      expect((await submitted(wrapper)).botEligible).toBe(true)
    },
  )
  it('disables unsupported combinations with their reason', () => {
    const { wrapper } = mountForm({ mode: 'create', rules: [] })
    expect(botSwitch(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('No hay combinaciones disponibles')
  })
  it('reacts to method changes and does not automatically re-enable the value', async () => {
    const { wrapper } = mountForm({ mode: 'create' })
    await botSwitch(wrapper).setValue(true)
    await wrapper.get('[data-testid="method-card-MANUAL"]').trigger('click')
    expect(botSwitch(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.get('[role="status"]').text()).toMatch(/Se desactivó.*método.*Manual/i)
    expect((await submitted(wrapper)).botEligible).toBe(false)
    await wrapper.get('[data-testid="method-card-AUTOMATIC"]').trigger('click')
    expect(botSwitch(wrapper).attributes('disabled')).toBeUndefined()
    expect((await submitted(wrapper)).botEligible).toBe(false)
  })
  it.each([
    { hasPriceLists: true, priceListIds: ['p'] },
    { hasDaysOfWeek: true, daysOfWeek: ['MONDAY'] },
    { customerScope: 'SPECIFIC' },
  ] as Partial<PromotionFormState>[])(
    'sends auto-off in the same form submission as incompatible conditions: %j',
    async (patch) => {
      const { wrapper } = mountForm()
      const conditions = wrapper.getComponent({ name: 'PromotionConditionsSection' })
      conditions.vm.$emit('update:modelValue', { ...conditions.props('modelValue'), ...patch })
      await flushPromises()
      expect(botSwitch(wrapper).attributes('disabled')).toBeDefined()
      expect(wrapper.get('[role="status"]').text()).toContain('Se desactivó')
      expect(await submitted(wrapper)).toMatchObject({ ...patch, botEligible: false })
    },
  )
  it('reacts to applies-to changes and asynchronously hydrated saved data', async () => {
    const { wrapper } = mountForm()
    wrapper
      .getComponent({ name: 'PromotionTargetItemsSection' })
      .vm.$emit('update:targetType', 'BRANDS')
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toMatch(/Aplica a: Marcas/)
    expect((await submitted(wrapper)).botEligible).toBe(false)
    await wrapper.setProps({ initialData: botPromotion() })
    expect((await submitted(wrapper)).botEligible).toBe(true)
    expect(botSwitch(wrapper).attributes('disabled')).toBeUndefined()
  })
  it('keeps saved true while loading, then evaluates after capabilities arrive', async () => {
    let resolve!: (value: { rules: BotEligibilityRule[] }) => void
    vi.mocked(promotionApi.getBotEligibilityCapabilities).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const { wrapper } = mountForm({ pending: true })
    expect(botSwitch(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Consultando disponibilidad')
    expect((await submitted(wrapper)).botEligible).toBe(true)
    resolve({ rules: [] })
    await flushPromises()
    expect((await submitted(wrapper)).botEligible).toBe(false)
    expect(wrapper.get('[role="status"]').text()).toContain('Se desactivó')
  })
  it('keeps saved true on request failure, even when a cached rule is incompatible', async () => {
    vi.mocked(promotionApi.getBotEligibilityCapabilities).mockRejectedValue(new Error('offline'))
    const { wrapper, queryClient } = mountForm({ pending: true })
    await flushPromises()
    expect(wrapper.text()).toContain('No se pudo consultar')
    expect(botSwitch(wrapper).attributes('disabled')).toBeDefined()
    expect((await submitted(wrapper)).botEligible).toBe(true)
    queryClient.setQueryData(promotionQueryKeys.botEligibilityCapabilities(tenant.value), {
      rules: [botRule],
    })
    await queryClient.invalidateQueries()
    await flushPromises()
    wrapper
      .getComponent({ name: 'PromotionTargetItemsSection' })
      .vm.$emit('update:targetType', 'BRANDS')
    await flushPromises()
    expect((await submitted(wrapper)).botEligible).toBe(true)
  })
  it('uses a tenant-scoped cached query and never shares capabilities across tenants', async () => {
    vi.mocked(promotionApi.getBotEligibilityCapabilities).mockResolvedValue({ rules: [botRule] })
    const { wrapper, queryClient } = mountForm({ pending: true })
    await flushPromises()
    expect(
      queryClient.getQueryData(promotionQueryKeys.botEligibilityCapabilities('tenant-a')),
    ).toEqual({ rules: [botRule] })
    expect(promotionApi.getBotEligibilityCapabilities).toHaveBeenCalledTimes(1)
    tenant.value = 'tenant-b'
    await flushPromises()
    expect(promotionApi.getBotEligibilityCapabilities).toHaveBeenCalledTimes(2)
    expect(
      queryClient.getQueryData(promotionQueryKeys.botEligibilityCapabilities('tenant-b')),
    ).toEqual({ rules: [botRule] })
    wrapper.unmount()
  })
})
