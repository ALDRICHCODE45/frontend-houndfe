/** Tones that features map their domain states to (aliases included). */
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

/** Tones of the shared StatusBadge (dot + tinted soft background). */
export type StatusBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const STATUS_TONE: Record<AppBadgeTone | 'danger', StatusBadgeTone> = {
  success: 'success',
  active: 'success',
  warning: 'warning',
  pending: 'warning',
  error: 'danger',
  inactive: 'danger',
  danger: 'danger',
  info: 'info',
  automatic: 'info',
  neutral: 'neutral',
  manual: 'neutral',
  type: 'neutral',
}

/** Resolve any badge tone (including the aliases and `danger`) to one of the five StatusBadge tones. */
export function statusBadgeTone(tone: AppBadgeTone | 'danger'): StatusBadgeTone {
  return STATUS_TONE[tone]
}
