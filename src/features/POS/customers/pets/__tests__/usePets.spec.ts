/** Pet queries and writes: permission gates, cache replacement, duplicate warning, version-conflict reload. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { withQuery } from '@/features/POS/backorders/composables/__tests__/withQuery'
import { petQueryKeys, usePetMutations, usePetsList } from '../usePets'
import { makePet } from './pet.fixture'
import type { Pet } from '../pet.types'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  restore: vi.fn(),
  remove: vi.fn(),
}))
const grants = vi.hoisted(() => ({ value: new Set<string>() }))
vi.mock('../pet.api', () => ({ petApi: api }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 't1',
    userCan: (action: string, subject: string) => grants.value.has(`${action}:${subject}`),
  }),
}))

const ALL = ['read:Customer', 'update:Customer', 'delete:Customer']
const activeKey = petQueryKeys.list('t1', 'c1', 'ACTIVE')
const archivedKey = petQueryKeys.list('t1', 'c1', 'ARCHIVED')

beforeEach(() => {
  vi.clearAllMocks()
  grants.value = new Set(ALL)
})

describe('usePetsList', () => {
  it('reads GET ?status with read:Customer only', async () => {
    api.list.mockResolvedValue([makePet()])
    const { result } = withQuery(() => usePetsList('c1', 'ACTIVE'))
    await flushPromises()
    expect(api.list).toHaveBeenCalledWith('c1', 'ACTIVE')
    expect(result.data.value).toEqual([makePet()])

    api.list.mockClear()
    grants.value = new Set()
    withQuery(() => usePetsList('c1', 'ACTIVE'))
    await flushPromises()
    expect(api.list).not.toHaveBeenCalled()
  })
})

describe('usePetMutations', () => {
  function setup(active: Pet[] = [makePet()], archived: Pet[] = []) {
    const ctx = withQuery(() => usePetMutations('c1'))
    ctx.client.setQueryData(activeKey, active)
    ctx.client.setQueryData(archivedKey, archived)
    return ctx
  }

  it('replaces the cached copy with the write response (no refetch) and drops warnings', async () => {
    const { result, client } = setup()
    api.update.mockResolvedValue({ ...makePet({ notes: 'Nervioso', version: 4 }), warnings: [] })
    const outcome = await result.update(makePet(), { version: 3, notes: 'Nervioso' })
    expect(outcome).toMatchObject({ status: 'saved', duplicateName: false })
    expect(client.getQueryData<Pet[]>(activeKey)).toEqual([
      makePet({ notes: 'Nervioso', version: 4 }),
    ])
    expect(api.list).not.toHaveBeenCalled()
  })

  it('moves an archived pet from the active list to the archived list', async () => {
    const { result, client } = setup()
    const archived = makePet({ status: 'ARCHIVED', archivedReason: 'Ya no está', version: 4 })
    api.archive.mockResolvedValue({ ...archived, warnings: [] })
    await result.archive(makePet(), 'Ya no está')
    expect(api.archive).toHaveBeenCalledWith('c1', 'p1', { version: 3, reason: 'Ya no está' })
    expect(client.getQueryData(activeKey)).toEqual([])
    expect(client.getQueryData(archivedKey)).toEqual([archived])
  })

  it('archive without a reason does not send one', async () => {
    const { result } = setup()
    api.archive.mockResolvedValue({ ...makePet({ status: 'ARCHIVED' }), warnings: [] })
    await result.archive(makePet(), '  ')
    expect(api.archive).toHaveBeenCalledWith('c1', 'p1', { version: 3 })
  })

  it('reports PET_NAME_DUPLICATE as a successful write with a duplicate notice', async () => {
    const { result, client } = setup([])
    api.create.mockResolvedValue({ ...makePet(), warnings: ['PET_NAME_DUPLICATE'] })
    const outcome = await result.create({ name: 'Bruno', species: 'DOG' })
    expect(outcome).toMatchObject({ status: 'saved', duplicateName: true })
    expect(client.getQueryData(activeKey)).toEqual([makePet()])
  })

  it('erases with the pet version and removes it from every list', async () => {
    const { result, client } = setup([makePet()], [])
    api.remove.mockResolvedValue(undefined)
    expect(await result.erase(makePet())).toEqual({ status: 'erased' })
    expect(api.remove).toHaveBeenCalledWith('c1', 'p1', 3)
    expect(client.getQueryData(activeKey)).toEqual([])
  })

  it('PET_VERSION_CONFLICT reloads the pets from the server', async () => {
    const { result, client } = setup()
    const conflict = {
      response: {
        status: 409,
        data: {
          statusCode: 409,
          error: 'PET_VERSION_CONFLICT',
          message: 'PET_VERSION_CONFLICT',
          currentVersion: 4,
        },
      },
    }
    api.update.mockRejectedValue(conflict)
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const outcome = await result.update(makePet(), { version: 3, name: 'Max' })
    expect(outcome).toMatchObject({ status: 'failed', error: { code: 'PET_VERSION_CONFLICT' } })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: petQueryKeys.all('t1', 'c1') })
  })

  it('ignores writes without update:Customer and erasure without delete:Customer', async () => {
    grants.value = new Set(['read:Customer', 'update:Customer'])
    const { result } = setup()
    expect(await result.erase(makePet())).toEqual({ status: 'ignored' })
    expect(api.remove).not.toHaveBeenCalled()

    grants.value = new Set(['read:Customer', 'delete:Customer'])
    expect(await result.create({ name: 'X', species: 'DOG' })).toEqual({ status: 'ignored' })
    expect(await result.restore(makePet({ status: 'ARCHIVED' }))).toEqual({ status: 'ignored' })
    expect(api.create).not.toHaveBeenCalled()
    expect(api.restore).not.toHaveBeenCalled()
  })
})
