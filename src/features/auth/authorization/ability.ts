import { AbilityBuilder, createMongoAbility, type MongoAbility } from '@casl/ability'
import type { AppAction, AppSubject } from '../interfaces/auth.types'

export type AppAbility = MongoAbility<[AppAction, AppSubject]>

const APP_ACTIONS: AppAction[] = ['create', 'read', 'update', 'delete', 'manage']
const APP_SUBJECTS: AppSubject[] = ['Product', 'Order', 'User', 'Role', 'Promotion', 'Customer', 'all']

export const ability = createMongoAbility<[AppAction, AppSubject]>([])

function isAppAction(value: string): value is AppAction {
  return APP_ACTIONS.includes(value as AppAction)
}

function isAppSubject(value: string): value is AppSubject {
  return APP_SUBJECTS.includes(value as AppSubject)
}

function parsePermissionCode(code: string): [AppAction, AppSubject] | null {
  const [actionRaw, subjectRaw, ...rest] = code.split(':')
  if (!actionRaw || !subjectRaw || rest.length > 0) return null
  if (!isAppAction(actionRaw) || !isAppSubject(subjectRaw)) return null
  return [actionRaw, subjectRaw]
}

export function updateAbilityFromPermissionCodes(permissionCodes: string[]) {
  const { can, rules } = new AbilityBuilder<AppAbility>(createMongoAbility)
  const uniqueCodes = Array.from(new Set(permissionCodes))

  uniqueCodes.forEach((code) => {
    const parsed = parsePermissionCode(code)
    if (!parsed) return

    const [action, subject] = parsed
    can(action, subject)
  })

  ability.update(rules)
}

export function resetAbility() {
  ability.update([])
}
