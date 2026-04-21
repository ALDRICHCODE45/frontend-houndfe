import { describe, it, expect } from 'vitest'
import {
  getStatusConfig,
  getTypeConfig,
  getMethodConfig,
  PROMOTION_STATUS_CONFIG,
  PROMOTION_TYPE_CONFIG,
  PROMOTION_METHOD_CONFIG,
} from '../promotionStatusConfig.utils'

describe('PROMOTION_STATUS_CONFIG — structure', () => {
  it('has ACTIVE config with label, color, and icon', () => {
    const config = PROMOTION_STATUS_CONFIG['ACTIVE']
    expect(config.label).toBe('Activa')
    expect(config.color).toBe('success')
    expect(config.variant).toBe('subtle')
    expect(config.icon).toBeDefined()
  })

  it('has SCHEDULED config with label, color, and icon', () => {
    const config = PROMOTION_STATUS_CONFIG['SCHEDULED']
    expect(config.label).toBe('Programada')
    expect(config.color).toBe('info')
    expect(config.variant).toBe('subtle')
    expect(config.icon).toBeDefined()
  })

  it('has ENDED config with label, color, and icon', () => {
    const config = PROMOTION_STATUS_CONFIG['ENDED']
    expect(config.label).toBe('Finalizada')
    expect(config.color).toBe('neutral')
    expect(config.variant).toBe('subtle')
    expect(config.icon).toBeDefined()
  })
})

describe('getStatusConfig', () => {
  it('returns ACTIVE config for ACTIVE status', () => {
    const config = getStatusConfig('ACTIVE')
    expect(config.label).toBe('Activa')
    expect(config.color).toBe('success')
  })

  it('returns SCHEDULED config for SCHEDULED status', () => {
    const config = getStatusConfig('SCHEDULED')
    expect(config.label).toBe('Programada')
    expect(config.color).toBe('info')
  })

  it('returns ENDED config for ENDED status', () => {
    const config = getStatusConfig('ENDED')
    expect(config.label).toBe('Finalizada')
    expect(config.color).toBe('neutral')
  })
})

describe('PROMOTION_TYPE_CONFIG — structure', () => {
  it('has PRODUCT_DISCOUNT with label and icon', () => {
    const config = PROMOTION_TYPE_CONFIG['PRODUCT_DISCOUNT']
    expect(config.label).toBe('Descuento en productos')
    expect(config.color).toBe('warning')
    expect(config.variant).toBe('subtle')
    expect(config.icon).toBeDefined()
  })

  it('has ORDER_DISCOUNT with label and icon', () => {
    const config = PROMOTION_TYPE_CONFIG['ORDER_DISCOUNT']
    expect(config.label).toBe('Descuento en pedido')
    expect(config.color).toBe('primary')
    expect(config.variant).toBe('subtle')
    expect(config.icon).toBeDefined()
  })

  it('has BUY_X_GET_Y with label and icon', () => {
    const config = PROMOTION_TYPE_CONFIG['BUY_X_GET_Y']
    expect(config.label).toBe('2x1, 3x2...')
    expect(config.color).toBe('success')
    expect(config.variant).toBe('subtle')
    expect(config.icon).toBeDefined()
  })

  it('has ADVANCED with label and icon', () => {
    const config = PROMOTION_TYPE_CONFIG['ADVANCED']
    expect(config.label).toBe('Avanzada')
    expect(config.color).toBe('secondary')
    expect(config.variant).toBe('subtle')
    expect(config.icon).toBeDefined()
  })
})

describe('getTypeConfig', () => {
  it('returns PRODUCT_DISCOUNT config', () => {
    const config = getTypeConfig('PRODUCT_DISCOUNT')
    expect(config.label).toBe('Descuento en productos')
  })

  it('returns ADVANCED config', () => {
    const config = getTypeConfig('ADVANCED')
    expect(config.label).toBe('Avanzada')
  })
})

describe('PROMOTION_METHOD_CONFIG — structure', () => {
  it('has AUTOMATIC with label and icon', () => {
    const config = PROMOTION_METHOD_CONFIG['AUTOMATIC']
    expect(config.label).toBe('Automático')
    expect(config.color).toBe('info')
    expect(config.variant).toBe('outline')
  })

  it('has MANUAL with label and icon', () => {
    const config = PROMOTION_METHOD_CONFIG['MANUAL']
    expect(config.label).toBe('Manual')
    expect(config.color).toBe('neutral')
    expect(config.variant).toBe('outline')
  })
})

describe('getMethodConfig', () => {
  it('returns AUTOMATIC config', () => {
    const config = getMethodConfig('AUTOMATIC')
    expect(config.label).toBe('Automático')
  })

  it('returns MANUAL config', () => {
    const config = getMethodConfig('MANUAL')
    expect(config.label).toBe('Manual')
  })
})
