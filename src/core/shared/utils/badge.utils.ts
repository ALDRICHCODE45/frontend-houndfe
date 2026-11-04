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

const DOT_CLASS_BY_COLOR: Record<AppBadgeColor, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  secondary: 'bg-violet-500',
  neutral: 'bg-gray-400',
}

/**
 * Resolve a semantic tone to the Tailwind background class for a colored dot.
 *
 * Single source of truth for dot colors, shared by StatusDotBadge and any
 * caller that drives a DotBadge from a semantic tone (e.g. the product stock
 * badge). Keyed by the resolved color so aliased tones (active->success, ...)
 * reuse the same dot automatically.
 */
export function toneToDotClass(tone: AppBadgeTone): string {
  return DOT_CLASS_BY_COLOR[badgeToneToColor(tone)]
}

/** Tones of the shared StatusBadge (dot + tinted soft background). */
export type StatusBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const STATUS_TONE_BY_COLOR: Record<AppBadgeColor, StatusBadgeTone> = {
  success: 'success',
  warning: 'warning',
  error: 'danger',
  info: 'info',
  secondary: 'neutral',
  neutral: 'neutral',
}

/**
 * Resolve any badge tone (including the legacy aliases and `danger`) to one of
 * the five StatusBadge tones, so StatusBadge and AppBadge callers share one
 * vocabulary.
 */
export function statusBadgeTone(tone: AppBadgeTone | 'danger'): StatusBadgeTone {
  return tone === 'danger' ? 'danger' : STATUS_TONE_BY_COLOR[badgeToneToColor(tone)]
}
