import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import PromotionCard from '../PromotionCard.vue'
import PromotionSummaryCard from '../PromotionSummaryCard.vue'
import { promotionToFormState } from '../../composables/usePromotionForm'
import { botPromotion } from '../../utils/__tests__/botEligibility.fixtures'

const stubs = {
  AppBadge: { name: 'AppBadge', props: ['label', 'icon'], template: '<span>{{ label }}</span>' },
  EntityAvatar: true,
  StatusDotBadge: true,
  PromotionCapacityStatus: true,
  UCard: { template: '<div><slot name="header" /><slot /></div>' },
  UIcon: true,
}

describe('promotion WhatsApp display', () => {
  function mountCard(botEligible: boolean) {
    return mount(PromotionCard, {
      props: { promotion: botPromotion({ botEligible }) },
      global: { stubs },
    })
  }

  it('renders the WhatsApp card badge with its icon when eligible', () => {
    const badge = mountCard(true)
      .findAllComponents({ name: 'AppBadge' })
      .find((candidate) => candidate.props('label') === 'WhatsApp')
    expect(badge?.props('icon')).toBe('i-lucide-message-circle')
  })

  it('renders no WhatsApp card badge when not eligible', () => {
    expect(mountCard(false).text()).not.toContain('WhatsApp')
  })
  it.each([true, false])(
    'renders the hydrated detail summary line only when eligible (%s)',
    (botEligible) => {
      const wrapper = mount(PromotionSummaryCard, {
        props: { formState: promotionToFormState(botPromotion({ botEligible })) },
        global: { stubs },
      })
      expect(wrapper.text().includes('Disponible para el chatbot (WhatsApp)')).toBe(botEligible)
    },
  )
  it('keeps availability layout and notices in the light/dark semantic promotion stylesheet', () => {
    const css = readFileSync('src/features/POS/promotions/styles/promotions-visual.css', 'utf8')
    expect(css).toMatch(
      /\.promotions-workspace \.promotions-availability-fields\s*\{[^}]*display: grid/s,
    )
    expect(css).toMatch(
      /\.promotions-workspace \.promotions-bot-notice\s*\{[^}]*color: var\(--hf-muted\)/s,
    )
  })
})
