import { http } from '@/core/shared/api/http'
import type { AssignableUser } from '../interfaces/user.types'

export const usersApi = {
  async listAssignable(): Promise<AssignableUser[]> {
    const { data } = await http.get<AssignableUser[]>('/users/assignable')
    return data
  },
}
