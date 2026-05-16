import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usersApi } from '../user.api'
import { http } from '@/core/shared/api/http'
import type { AssignableUser } from '../../interfaces/user.types'

vi.mock('@/core/shared/api/http', () => ({
  http: {
    get: vi.fn(),
  },
}))

describe('usersApi.listAssignable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs /users/assignable and returns the array', async () => {
    const mockUsers: AssignableUser[] = [
      { id: 'u-1', name: 'Ana Pérez' },
      { id: 'u-2', name: 'César Flores' },
    ]
    vi.mocked(http.get).mockResolvedValue({ data: mockUsers })

    const result = await usersApi.listAssignable()

    expect(http.get).toHaveBeenCalledWith('/users/assignable')
    expect(result).toEqual(mockUsers)
  })

  it('returns empty array when no users assignable', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: [] })

    const result = await usersApi.listAssignable()

    expect(result).toEqual([])
  })
})
