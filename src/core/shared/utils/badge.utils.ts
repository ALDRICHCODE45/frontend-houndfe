export type AppBadgeTone =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'active'
  | 'pending'
  | 'inactive'
  | 'manual'
  | 'automatic'
  | 'type'

export type AppBadgeColor = 'success' | 'warning' | 'error' | 'info' | 'secondary' | 'neutral'

export function badgeToneToColor(tone: AppBadgeTone): AppBadgeColor {
  switch (tone) {
    case 'active':
      return 'success'
    case 'pending':
      return 'warning'
    case 'inactive':
      return 'error'
    case 'manual':
      return 'secondary'
    case 'automatic':
      return 'info'
    case 'type':
      return 'secondary'
    default:
      return tone
  }
}

export function activityToBadgeTone(isActive: boolean): AppBadgeTone {
  return isActive ? 'active' : 'inactive'
}
