import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
import EditReferenceSlideover from '../EditReferenceSlideover.vue'
import type { SaleDetailPayment } from '../../interfaces/sale.types'

function makePayment(overrides: Partial<SaleDetailPayment> = {}): SaleDetailPayment {
  return {
    paymentId: 'pay-1',
    method: 'CARD_DEBIT',
    amountCents: 127000,
    tenderedCents: 127000,
    changeCents: 0,
    reference: 'AUTH-42',
    paidAt: '2026-05-06T14:43:00.000Z',
    ...overrides,
  }
}

/**
 * The slideover teleports its body/footer content to `document.body`, so
 * element queries must go through `document` rather than the wrapper.
 */
function $input(): HTMLInputElement {
  const node = document.querySelector('input[data-testid="edit-reference-input"]')
  if (!(node instanceof HTMLInputElement)) {
    throw new Error('edit-reference-input not found in document.body')
  }
  return node
}

function $button(testid: string): HTMLButtonElement {
  const node = document.querySelector(`[data-testid="${testid}"]`)
  if (!(node instanceof HTMLElement)) {
    throw new Error(`${testid} not found in document.body`)
  }
  return node as HTMLButtonElement
}

function mountSlideover(props: Record<string, unknown>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  })
  return mountWithUApp(EditReferenceSlideover, {
    props,
    attachTo: document.body,
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
    },
  })
}

describe('EditReferenceSlideover', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('pre-fills the input with currentReference when opened', async () => {
    mountSlideover({
      open: true,
      currentReference: 'AUTH-42',
      paymentMethod: 'CARD_DEBIT',
    })
    await flushPromises()

    expect($input().value).toBe('AUTH-42')
  })

  it('shows an empty input when currentReference is null', async () => {
    mountSlideover({
      open: true,
      currentReference: null,
      paymentMethod: 'CARD_DEBIT',
    })
    await flushPromises()

    expect($input().value).toBe('')
  })

  it('submits a trimmed string when the user types and clicks Guardar', async () => {
    const wrapper = mountSlideover({
      open: true,
      currentReference: null,
      paymentMethod: 'CARD_DEBIT',
    })
    await flushPromises()

    const input = $input()
    input.value = '  AUTH-99  '
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()

    $button('edit-reference-submit').dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(wrapper.emitted('submit')?.[0]).toEqual([{ reference: 'AUTH-99' }])
  })

  it('submits null when the user submits an empty string', async () => {
    const wrapper = mountSlideover({
      open: true,
      currentReference: 'AUTH-42',
      paymentMethod: 'CARD_DEBIT',
    })
    await flushPromises()

    const input = $input()
    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()

    $button('edit-reference-submit').dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(wrapper.emitted('submit')?.[0]).toEqual([{ reference: null }])
  })

  it('clear button empties the input but does not submit', async () => {
    const wrapper = mountSlideover({
      open: true,
      currentReference: 'AUTH-42',
      paymentMethod: 'CARD_DEBIT',
    })
    await flushPromises()

    $button('edit-reference-clear').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect($input().value).toBe('')
    expect(wrapper.emitted('submit')).toBeFalsy()
  })

  it('cancel button emits update:open false', async () => {
    const wrapper = mountSlideover({
      open: true,
      currentReference: 'AUTH-42',
      paymentMethod: 'CARD_DEBIT',
    })
    await flushPromises()

    $button('edit-reference-cancel').dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })

  it('Enter key in the input submits', async () => {
    const wrapper = mountSlideover({
      open: true,
      currentReference: null,
      paymentMethod: 'CARD_DEBIT',
    })
    await flushPromises()

    const input = $input()
    input.value = 'AUTH-99'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    expect(wrapper.emitted('submit')?.[0]).toEqual([{ reference: 'AUTH-99' }])
  })
})