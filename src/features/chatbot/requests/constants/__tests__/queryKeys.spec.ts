import { describe, expect, it } from 'vitest'
import { chatbotMediaKeys, chatbotRequestKeys } from '../queryKeys'

const T = 'tenant-1'

describe('chatbotRequestKeys', () => {
  it('every key lives under all(tenant), so one invalidation reaches the whole feature', () => {
    const all = chatbotRequestKeys.all(T)
    const keys = [
      chatbotRequestKeys.groups(T, { status: 'open' }),
      chatbotRequestKeys.byCustomer(T, 'k1.a', { status: 'open' }),
      chatbotRequestKeys.counts(T),
      chatbotRequestKeys.history(T, {}),
      chatbotRequestKeys.detail(T, 'req-1'),
      chatbotRequestKeys.audit(T, 'req-1'),
      chatbotRequestKeys.mergeCandidates(T, 'req-1'),
      chatbotRequestKeys.assignableUsers(T),
      chatbotRequestKeys.zoneImpact(T, 'req-1'),
      chatbotRequestKeys.conversation(T, 'req-1'),
    ]
    for (const key of keys) expect(key.slice(0, all.length)).toEqual([...all])
  })

  it('is tenant-scoped: a branch switch never reuses another tenant data', () => {
    expect(chatbotRequestKeys.counts('a')).not.toEqual(chatbotRequestKeys.counts('b'))
    expect(chatbotRequestKeys.detail('a', 'x')).not.toEqual(chatbotRequestKeys.detail('b', 'x'))
  })

  it('separates entities and carries every input the query depends on', () => {
    expect(chatbotRequestKeys.groups(T, { status: 'open' })).not.toEqual(
      chatbotRequestKeys.groups(T, { status: 'resolved' }),
    )
    expect(chatbotRequestKeys.byCustomer(T, 'k1.a', {})).not.toEqual(chatbotRequestKeys.byCustomer(T, 'k1.b', {}))
    expect(chatbotRequestKeys.detail(T, 'a')).not.toEqual(chatbotRequestKeys.detail(T, 'b'))
    expect(chatbotRequestKeys.detail(T, 'a')).not.toEqual(chatbotRequestKeys.audit(T, 'a'))
    expect(chatbotRequestKeys.mergeCandidates(T, 'a')).not.toEqual(chatbotRequestKeys.zoneImpact(T, 'a'))
  })

  it('keys are JSON-serializable', () => {
    const key = chatbotRequestKeys.groups(T, { status: 'open', overdue: true })
    expect(JSON.parse(JSON.stringify(key))).toEqual(key)
  })
})

describe('chatbotMediaKeys', () => {
  it('is tenant-scoped and per media id, outside all(tenant) so a command never refetches blobs', () => {
    expect(chatbotMediaKeys.file('a', 'm-1')).not.toEqual(chatbotMediaKeys.file('b', 'm-1'))
    expect(chatbotMediaKeys.file(T, 'm-1')).not.toEqual(chatbotMediaKeys.file(T, 'm-2'))
    expect(chatbotMediaKeys.file(T, 'm-1').slice(0, 2)).toEqual([...chatbotMediaKeys.all(T)])
    expect(chatbotMediaKeys.file(T, 'm-1')[0]).not.toBe(chatbotRequestKeys.all(T)[0])
  })
})
