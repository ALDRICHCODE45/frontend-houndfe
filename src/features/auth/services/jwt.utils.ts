import { jwtDecode } from 'jwt-decode'
import type { AuthJwtClaims } from '../interfaces/auth.types'

export function decodeJwtClaims(token: string): AuthJwtClaims {
  return jwtDecode<AuthJwtClaims>(token)
}
