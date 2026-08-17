/**
 * WU-E RED tests — getProductTypeBadge utility. Returns the tone/label pair
 * the Products list cell will render via AppBadge.
 */

import { describe, expect, it } from 'vitest'
import { getProductTypeBadge } from '../productStatusConfig.utils'

describe('WU-F · getProductTypeBadge', () => {
  it('SERVICE returns info tone with "Servicio" label', () => {
    expect(getProductTypeBadge('SERVICE')).toEqual({ tone: 'info', label: 'Servicio' })
  })

  it('PRODUCT returns neutral tone with "Producto" label', () => {
    expect(getProductTypeBadge('PRODUCT')).toEqual({ tone: 'neutral', label: 'Producto' })
  })
})