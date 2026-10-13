import { describe, expect, it } from 'vitest'
import { hasSalesEntryToken } from '../salesEntryPortal'

describe('hasSalesEntryToken', () => {
  it.each([
    ['hf-theme hf-ui sales-entry-portal', true],
    ['sales-entry-portal', true],
    ['hf-theme  sales-entry-portal  sales-pos-cart', true],
    ['hf-theme hf-ui not-sales-entry-portal', false],
    ['sales-entry-portal-legacy', false],
    ['hf-theme hf-ui quotations-workspace-portal', false],
    ['', false],
    [undefined, false],
    [null, false],
  ])('%s -> %s', (portalClass, expected) => {
    expect(hasSalesEntryToken(portalClass)).toBe(expected)
  })
})
