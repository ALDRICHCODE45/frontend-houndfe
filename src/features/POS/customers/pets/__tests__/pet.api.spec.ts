/** Pet transport (handoff 27 §3): paths, methods, the `?status` list filter and DELETE `?version`. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import { petApi } from '../pet.api'
import { makePet } from './pet.fixture'

vi.mock('@/core/shared/api/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const get = vi.mocked(http.get)
const post = vi.mocked(http.post)
const patch = vi.mocked(http.patch)
const del = vi.mocked(http.delete)

beforeEach(() => vi.clearAllMocks())

describe('petApi', () => {
  it('lists with GET /customers/:id/pets and the status query', async () => {
    get.mockResolvedValue({ data: [makePet()] })
    const pets = await petApi.list('c1', 'ARCHIVED')
    expect(get).toHaveBeenCalledWith('/customers/c1/pets', { params: { status: 'ARCHIVED' } })
    expect(pets).toEqual([makePet()])
  })

  it('creates with POST and returns the pet with its warnings', async () => {
    const written = { ...makePet(), warnings: ['PET_NAME_DUPLICATE'] }
    post.mockResolvedValue({ data: written })
    const body = { name: 'Bruno', species: 'DOG' as const, approxAge: { months: 10 } }
    expect(await petApi.create('c1', body)).toEqual(written)
    expect(post).toHaveBeenCalledWith('/customers/c1/pets', body)
  })

  it('edits with PATCH /customers/:id/pets/:petId', async () => {
    patch.mockResolvedValue({ data: { ...makePet(), warnings: [] } })
    await petApi.update('c1', 'p1', { version: 3, allergies: null })
    expect(patch).toHaveBeenCalledWith('/customers/c1/pets/p1', { version: 3, allergies: null })
  })

  it('archives and restores with POST …/archive and …/restore', async () => {
    post.mockResolvedValue({ data: { ...makePet(), warnings: [] } })
    await petApi.archive('c1', 'p1', { version: 3, reason: 'Falleció' })
    await petApi.restore('c1', 'p1', { version: 4 })
    expect(post).toHaveBeenNthCalledWith(1, '/customers/c1/pets/p1/archive', {
      version: 3,
      reason: 'Falleció',
    })
    expect(post).toHaveBeenNthCalledWith(2, '/customers/c1/pets/p1/restore', { version: 4 })
  })

  it('erases with DELETE and the version as a query parameter, never a body', async () => {
    del.mockResolvedValue({ status: 204 })
    await petApi.remove('c1', 'p1', 5)
    expect(del).toHaveBeenCalledWith('/customers/c1/pets/p1', { params: { version: 5 } })
    const config = del.mock.calls[0]?.[1] as Record<string, unknown>
    expect(config).not.toHaveProperty('data')
  })
})
