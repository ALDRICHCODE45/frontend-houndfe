/**
 * Presentation helpers of the notifications feature. The contract sends `title` and `body` as
 * text; the label, icon and tone below are derived on the client from `type` (design 02-panel-lateral).
 */
import type { NotificationItem } from '../interfaces/notifications.types'

export type NotificationTone = 'info' | 'warning' | 'danger' | 'neutral'

export interface NotificationMeta {
  icon: string
  tone: NotificationTone
  /** Text label, so the type never depends on color or icon alone. */
  label: string
}

const TYPE_META: Record<string, NotificationMeta> = {
  REQUEST_CREATED: { icon: 'i-lucide-inbox', tone: 'info', label: 'Nueva' },
  REQUEST_REASSIGNED: { icon: 'i-lucide-arrow-left-right', tone: 'info', label: 'Reasignada a ti' },
  REQUEST_CANCELLED: { icon: 'i-lucide-ban', tone: 'neutral', label: 'Cerrada' },
  REQUEST_CLAIM_REMINDER: { icon: 'i-lucide-clock', tone: 'warning', label: 'Sin tomar' },
  REQUEST_ESCALATION: { icon: 'i-lucide-triangle-alert', tone: 'warning', label: 'Por vencer' },
  REQUEST_OVERDUE: { icon: 'i-lucide-triangle-alert', tone: 'danger', label: 'Vencida' },
}

const FALLBACK_META: NotificationMeta = { icon: 'i-lucide-bell', tone: 'neutral', label: 'Aviso' }

export function notificationMeta(type: string): NotificationMeta {
  return TYPE_META[type] ?? FALLBACK_META
}

/** The backend count is unbounded per branch: the «99+» cap is the client's. */
export function countLabel(count: number): string {
  return count > 99 ? '99+' : String(count)
}

export function bellLabel(count: number, stale: boolean): string {
  const base =
    count <= 0
      ? 'Notificaciones, sin avisos nuevos'
      : count > 99
        ? 'Notificaciones, más de 99 sin leer'
        : `Notificaciones, ${count} sin leer`
  return stale ? `${base} (no se pudo actualizar)` : base
}

/** Where a notice leads; `null` for a notice that is not about a request. */
export function notificationDetailPath(requestId: string | null): string | null {
  return requestId ? `/chatbot/solicitudes/${encodeURIComponent(requestId)}` : null
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const pad = (value: number) => String(value).padStart(2, '0')
const clock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

/** Whole calendar days from `now` to `date` in the runtime zone (negative = past). */
function dayDiff(date: Date, now: Date): number {
  return Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000)
}

/** Short label of a row: «hace 7 min», «08:30», «ayer 17:02», «lun 9 nov». Runtime time zone. */
export function relativeTime(iso: string, now: Date): string {
  const date = new Date(iso)
  const diff = dayDiff(date, now)
  if (diff === 0) {
    const minutes = Math.round((now.getTime() - date.getTime()) / 60_000)
    if (minutes < 1) return 'ahora'
    return minutes < 60 ? `hace ${minutes} min` : clock(date)
  }
  if (diff === -1) return `ayer ${clock(date)}`
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`
}

/** Full date for the `title` tooltip of the time: «mar 10 nov, 17:02». */
export function fullTime(iso: string): string {
  const date = new Date(iso)
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}, ${clock(date)}`
}

export interface NotificationGroup {
  key: 'today' | 'before'
  label: 'Hoy' | 'Antes'
  items: NotificationItem[]
}

/** «Hoy» and «Antes» (design groups), in the given order; empty groups are dropped. */
export function groupByDay(items: NotificationItem[], now: Date): NotificationGroup[] {
  const today = items.filter((item) => dayDiff(new Date(item.createdAt), now) === 0)
  const before = items.filter((item) => dayDiff(new Date(item.createdAt), now) !== 0)
  const groups: NotificationGroup[] = [
    { key: 'today', label: 'Hoy', items: today },
    { key: 'before', label: 'Antes', items: before },
  ]
  return groups.filter((group) => group.items.length > 0)
}
