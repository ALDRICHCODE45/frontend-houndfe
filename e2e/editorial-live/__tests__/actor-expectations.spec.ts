import { describe, expect, it } from 'vitest'

import { exchangeLine, publishesEditorial, readsProductName, savedStatusPattern } from '../support/actor-expectations'

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

  it.each(['Revisando qué falta para publicar…', 'Listo para publicar', ' Completa lo pendiente para publicar '])('publishers accept the publish-bar wording «%s»', text => {
    expect(savedStatusPattern(ACTORS.manageAll).test(text)).toBe(true)
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
