/**
 * WU-F tests — getProductTypeBadge utility. Returns the tone/icon/label triple
 * the Products list cell renders via AppBadge, matching the promotions
 * type-badge convention (violet `type` tone + icon).
 */

import { describe, expect, it } from 'vitest'
import { getProductTypeBadge } from '../productStatusConfig.utils'

describe('WU-F · getProductTypeBadge', () => {
  it('SERVICE returns type tone + clock icon + "Servicio" label', () => {
    expect(getProductTypeBadge('SERVICE')).toEqual({
      tone: 'type',
      label: 'Servicio',
      icon: 'i-lucide-clock',
    })
  })

  it('PRODUCT returns type tone + package icon + "Producto" label', () => {
    expect(getProductTypeBadge('PRODUCT')).toEqual({
      tone: 'type',
      label: 'Producto',
      icon: 'i-lucide-package',
    })
  })
})
