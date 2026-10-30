import { describe, expect, it } from 'vitest'
import { canPublishEditorial } from '../editorial-access'

const read = 'read:ProductEditorialDraft'
const publish = 'publish:ProductEditorialDraft'
describe('exact publish access', () => {
  it('allows the global claim without individual grants', () => {
    expect(canPublishEditorial([], true)).toBe(true)
    expect(canPublishEditorial([], false)).toBe(false)
  })
  it.each([
    [[read, publish], true], [[read, publish, 'update:ProductEditorialDraft'], true],
    [['update:ProductEditorialDraft'], false], [[read, 'update:ProductEditorialDraft'], false],
    [['manage:all'], true], [[publish], false], [[read], false],
    [[read, 'manage:ProductEditorialDraft', 'publish:*'], false],
  ] as const)('checks literal grants %j', (codes, allowed) => {
    expect(canPublishEditorial(codes)).toBe(allowed)
  })
})
