import { format, isToday, isYesterday } from 'date-fns'
import { es } from 'date-fns/locale'

export function formatSaleDate(iso: string): string {
  const date = new Date(iso)

  if (isToday(date)) {
    return `Hoy a las ${format(date, 'HH:mm', { locale: es })}`
  }

  if (isYesterday(date)) {
    return `Ayer a las ${format(date, 'HH:mm', { locale: es })}`
  }

  return format(date, 'dd/MM/yyyy HH:mm:ss', { locale: es })
}
