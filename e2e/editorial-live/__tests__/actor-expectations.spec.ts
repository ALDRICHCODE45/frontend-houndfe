import { describe, expect, it } from 'vitest'

import { classifyFailures, exchangeLine, isUnservedShellRead, publishesEditorial, readsProductName, savedStatusPattern, statusesOf, stepLog } from '../support/actor-expectations'

const READ = 'read:ProductEditorialDraft'
const UPDATE = 'update:ProductEditorialDraft'
const PUBLISH = 'publish:ProductEditorialDraft'
const ACTORS = {
  superadminGlobal: { isSuperAdmin: true, permissionCodes: [] },
  manageAll: { isSuperAdmin: false, permissionCodes: ['manage:all'] },
  editorialOnly: { isSuperAdmin: false, permissionCodes: [READ, UPDATE] },
  editorialPublisher: { isSuperAdmin: false, permissionCodes: [READ, UPDATE, PUBLISH] },
  editorialReader: { isSuperAdmin: false, permissionCodes: [READ, UPDATE, 'read:Product'] },
} as const

describe('readsProductName', () => {
  it.each([
    ['superadminGlobal', true], ['manageAll', true], ['editorialReader', true], ['editorialOnly', false], ['editorialPublisher', false],
  ] as const)('%s → %s', (actor, expected) => expect(readsProductName(ACTORS[actor])).toBe(expected))
})

describe('publishesEditorial / savedStatusPattern', () => {
  it.each([
    ['superadminGlobal', true], ['manageAll', true], ['editorialPublisher', true], ['editorialOnly', false],
  ] as const)('%s publishes: %s', (actor, expected) => expect(publishesEditorial(ACTORS[actor])).toBe(expected))

  it('publish without the read grant is not a publisher', () => {
    expect(publishesEditorial({ isSuperAdmin: false, permissionCodes: [PUBLISH] })).toBe(false)
  })

  it.each(['Listo para publicar', ' Completa lo pendiente para publicar '])('publishers accept the settled publish-bar wording «%s»', text => {
    expect(savedStatusPattern(ACTORS.manageAll).test(text)).toBe(true)
  })

  it('publishers do not accept the transient readiness wording as settled', () => {
    expect(savedStatusPattern(ACTORS.manageAll).test('Revisando qué falta para publicar…')).toBe(false)
  })

  it('publishers never accept an error or «Guardado» as the post-save state', () => {
    expect(savedStatusPattern(ACTORS.superadminGlobal).test('No pudimos revisar qué falta para publicar.')).toBe(false)
    expect(savedStatusPattern(ACTORS.superadminGlobal).test('Guardado hace un momento')).toBe(false)
  })

  it('non-publishers keep the save bar «Guardado»', () => {
    expect(savedStatusPattern(ACTORS.editorialOnly).test('Guardado hace un momento')).toBe(true)
    expect(savedStatusPattern(ACTORS.editorialOnly).test('Listo para publicar')).toBe(false)
  })
})

describe('exchangeLine', () => {
  it('prints method, path and status, or pending', () => {
    expect(exchangeLine({ method: 'PUT', path: '/products/p/editorial/draft', status: 409 })).toBe('PUT /products/p/editorial/draft -> 409')
    expect(exchangeLine({ method: 'GET', path: '/x', status: null })).toBe('GET /x -> pending')
  })
})

describe('statusesOf / stepLog', () => {
  const log = [
    { method: 'GET', path: '/products/p/editorial', status: 200 },
    { method: 'PUT', path: '/products/p/editorial/draft', status: 200 },
    { method: 'GET', path: '/products/p/editorial/draft/readiness', status: null },
    { method: 'PUT', path: '/products/p/editorial/draft', status: 409 },
  ]
  it('collects the statuses of one method and path in order', () => {
    expect(statusesOf(log, 'PUT', '/products/p/editorial/draft')).toEqual([200, 409])
    expect(statusesOf(log, 'POST', '/products/p/editorial/draft')).toEqual([])
  })
  it('prints the exchanges of a step from its start index', () => {
    expect(stepLog(log, 2)).toBe('GET /products/p/editorial/draft/readiness -> pending; PUT /products/p/editorial/draft -> 409')
    expect(stepLog(log, 4)).toBe('no backend request')
  })
})

describe('unserved shell-read allowlist', () => {
  const ex = (method: string, path: string, status: number | null) => ({ method, path, status })
  it.each(['/sales/refunds/pending', '/delivery-zone-validations', '/notifications/unread-count'])('allows GET %s -> 404', path => {
    expect(isUnservedShellRead(ex('GET', path, 404))).toBe(true)
  })
  it.each([
    ['same path, 500', ex('GET', '/sales/refunds/pending', 500)],
    ['same path, 403', ex('GET', '/notifications/unread-count', 403)],
    ['same path, other method', ex('POST', '/delivery-zone-validations', 404)],
    ['sub-path', ex('GET', '/delivery-zone-validations/x', 404)],
    ['prefix look-alike', ex('GET', '/sales/refunds/pending-extra', 404)],
    ['other path, 404', ex('GET', '/sales/refunds', 404)],
    ['product, 404', ex('GET', '/products/p', 404)],
    ['product, 403', ex('GET', '/products/p', 403)],
    ['editorial read, 404', ex('GET', '/products/p/editorial', 404)],
    ['editorial PUT, 409', ex('PUT', '/products/p/editorial/draft', 409)],
    ['editorial discard, 500', ex('POST', '/products/p/editorial/draft/discard', 500)],
    ['vocabulary, 400', ex('GET', '/catalog-editorial/vocabulary', 400)],
  ])('rejects %s', (_label, exchange) => {
    expect(isUnservedShellRead(exchange)).toBe(false)
  })
  it('classifies ≥400 exchanges; 2xx and pending are neither', () => {
    const { unserved, failed } = classifyFailures([
      ex('GET', '/sales/refunds/pending', 404), ex('GET', '/sales/refunds/pending', 500),
      ex('PUT', '/products/p/editorial/draft', 200), ex('GET', '/products/p/editorial', null), ex('GET', '/products/p', 404),
    ])
    expect(unserved).toEqual([ex('GET', '/sales/refunds/pending', 404)])
    expect(failed).toEqual([ex('GET', '/sales/refunds/pending', 500), ex('GET', '/products/p', 404)])
  })
})
