/** es-MX copy and small date helpers of the chatbot settings screen. */
import type { ChatbotSettingsSubtype, ChatbotWeekday } from '../interfaces/chatbot-settings.types'

/** Not in the contract (it takes the IANA zone as is); the Envíos editor uses the same cap. */
export const MAX_RANGES_PER_DAY = 6

export const DAY_LABELS: Record<ChatbotWeekday, { long: string; short: string }> = {
  MONDAY: { long: 'Lunes', short: 'lun' },
  TUESDAY: { long: 'Martes', short: 'mar' },
  WEDNESDAY: { long: 'Miércoles', short: 'mié' },
  THURSDAY: { long: 'Jueves', short: 'jue' },
  FRIDAY: { long: 'Viernes', short: 'vie' },
  SATURDAY: { long: 'Sábado', short: 'sáb' },
  SUNDAY: { long: 'Domingo', short: 'dom' },
}

export const SUBTYPE_COPY: Record<ChatbotSettingsSubtype, { name: string; hint: string; icon: string }> = {
  RESTOCK: { name: 'Reposición', hint: 'Un cliente pide que vuelva un producto.', icon: 'i-lucide-package' },
  EXPIRATION: { name: 'Caducidad', hint: 'Se consulta una fecha de caducidad.', icon: 'i-lucide-calendar-clock' },
  DELIVERY_ZONE: { name: 'Zona de entrega', hint: 'Se valida una dirección fuera de las zonas.', icon: 'i-lucide-map-pin' },
  TRANSFER_RECEIPT: { name: 'Comprobante', hint: 'Comprobante de transferencia por confirmar.', icon: 'i-lucide-receipt' },
  TALK_TO_HUMAN: { name: 'Hablar con una persona', hint: 'El cliente pide atención en vivo.', icon: 'i-lucide-message-circle' },
  COMPLAINT: { name: 'Queja', hint: 'Una queja que requiere seguimiento.', icon: 'i-lucide-triangle-alert' },
  UNKNOWN_QUESTION: { name: 'Pregunta del bot', hint: 'Una pregunta que el bot no supo contestar.', icon: 'i-lucide-circle-help' },
  DISCOUNT: { name: 'Descuento', hint: 'El cliente pide un descuento.', icon: 'i-lucide-badge-percent' },
}

/** The contract has no zone list; the fixed one (owner answer) covers the Mexican zones. */
const TIME_ZONES: Array<{ value: string; label: string }> = [
  { value: 'America/Mexico_City', label: 'Ciudad de México (GMT−6)' },
  { value: 'America/Monterrey', label: 'Monterrey (GMT−6)' },
  { value: 'America/Tijuana', label: 'Tijuana (GMT−8)' },
  { value: 'America/Hermosillo', label: 'Hermosillo (GMT−7)' },
  { value: 'America/Cancun', label: 'Cancún (GMT−5)' },
]

/** The fixed list, plus the saved zone when it is not in it (never silently replaced). */
export function timeZoneOptions(current: string): Array<{ value: string; label: string }> {
  return TIME_ZONES.some((zone) => zone.value === current) || !current
    ? TIME_ZONES
    : [{ value: current, label: current }, ...TIME_ZONES]
}

/** `YYYY-MM-DD` of «now» in the branch zone (the zone closed dates are written in). */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const parts = (zone?: string) => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now)
    } catch {
      return null
    }
  }
  return parts(timeZone) ?? parts(undefined) ?? now.toISOString().slice(0, 10)
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const WEEKDAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

const utc = (date: string) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return Date.UTC(y, m - 1, d)
}

/** «vie 25 dic 2026», how far from today, and whether it is already past. */
export function describeDate(date: string, today: string): { label: string; relative: string; past: boolean } {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const label = `${WEEKDAYS_SHORT[new Date(utc(date)).getUTCDay()]} ${d} ${MONTHS[m - 1]} ${y}`
  const days = Math.round((utc(date) - utc(today)) / 86_400_000)
  const relative =
    days === 0 ? 'hoy' : days === 1 ? 'mañana' : days === -1 ? 'ayer' : days > 0 ? `en ${days} días` : `hace ${-days} días`
  return { label, relative, past: days < 0 }
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
