/**
 * getProductTypeBadge returns the label and icon the list renders for the type
 * (a category, not a status, so there is no tone).
 */

import { describe, expect, it } from 'vitest'
import { getProductTypeBadge } from '../productStatusConfig.utils'

describe('getProductTypeBadge', () => {
  it('SERVICE returns the clock icon and the "Servicio" label', () => {
    expect(getProductTypeBadge('SERVICE')).toEqual({ label: 'Servicio', icon: 'i-lucide-clock' })
  })

  it('PRODUCT returns the package icon and the "Producto" label', () => {
    expect(getProductTypeBadge('PRODUCT')).toEqual({ label: 'Producto', icon: 'i-lucide-package' })
  })
})
