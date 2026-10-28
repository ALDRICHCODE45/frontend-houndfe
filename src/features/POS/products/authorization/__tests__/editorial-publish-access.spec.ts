import { describe, expect, it } from 'vitest'
import { canPublishEditorial } from '../editorial-access'

const read = 'read:ProductEditorialDraft'
const publish = 'publish:ProductEditorialDraft'
describe('exact publish access', () => {
  it.each([
    [[read, publish], true], [[read, publish, 'update:ProductEditorialDraft'], true],
    [['update:ProductEditorialDraft'], false], [[read, 'update:ProductEditorialDraft'], false],
    [['manage:all'], false], [[publish], false], [[read], false],
    [[read, 'manage:ProductEditorialDraft', 'publish:*'], false],
  ] as const)('checks literal grants %j', (codes, allowed) => {
    expect(canPublishEditorial(codes)).toBe(allowed)
  })
})
