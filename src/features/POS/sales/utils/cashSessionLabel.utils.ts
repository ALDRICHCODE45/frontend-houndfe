/**
 * Human label of an OPEN cash session for the till pickers: «Caja Principal · abierta 9:12»
 * (today) or «Caja Principal · abierta 17 nov, 9:00» (another day), in the sucursal zone
 * (Mexico City). Never the raw session id: an unknown register reads «Caja».
 */
import { MEXICO_CITY_TIME_ZONE } from '@/core/shared/utils/mexicoCityCalendar'
import type { CashSession } from '@/features/POS/cash-register/interfaces/cash.types'

const FALLBACK_REGISTER = 'Caja'

const dayFormat = new Intl.DateTimeFormat('es-MX', {
  timeZone: MEXICO_CITY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const shortDayFormat = new Intl.DateTimeFormat('es-MX', {
  timeZone: MEXICO_CITY_TIME_ZONE,
  day: 'numeric',
  month: 'short',
})
const timeFormat = new Intl.DateTimeFormat('es-MX', {
  timeZone: MEXICO_CITY_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: 'h23',
})

function openedLabel(iso: string | undefined, now: Date): string | null {
  if (!iso) return null
  const opened = new Date(iso)
  if (Number.isNaN(opened.getTime())) return null
  const parts = timeFormat.formatToParts(opened)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  const time = `${Number(part('hour'))}:${part('minute')}`
  if (dayFormat.format(opened) === dayFormat.format(now)) return time
  const day = shortDayFormat.format(opened).replace(/\./g, '')
  return `${day}, ${time}`
}

export function cashSessionLabel(
  session: Pick<CashSession, 'registerId' | 'openedAt'>,
  registerNames: Readonly<Record<string, string>> = {},
  now: Date = new Date(),
): string {
  const register = registerNames[session.registerId]?.trim() || FALLBACK_REGISTER
  const opened = openedLabel(session.openedAt, now)
  return opened ? `${register} · abierta ${opened}` : register
}
