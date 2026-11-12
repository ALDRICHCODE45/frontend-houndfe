/** Where a validation key lives on the page: the label of the checklist and the id to scroll to. */
import type { ChatbotSettingsSubtype, ChatbotWeekday } from '../interfaces/chatbot-settings.types'
import { DAY_LABELS, SUBTYPE_COPY } from './settingsLabels'

const FIXED: Record<string, { label: string; id: string }> = {
  'h:week': { label: 'Horario de atención', id: 'sec-hours' },
  'h:tz': { label: 'Zona horaria', id: 'cbs-tz' },
  'd:list': { label: 'Fechas cerradas', id: 'sec-dates' },
  'x:window': { label: 'Aviso de ventana', id: 'cbs-window' },
  'x:margin': { label: 'Margen de comprobantes', id: 'cbs-margin' },
  'x:template': { label: 'Plantilla', id: 'cbs-template' },
  'x:templateCost': { label: 'Texto de costo', id: 'cbs-cost' },
  'c:slot': { label: 'Duración de cada horario', id: 'cbs-slot' },
  'c:offered': { label: 'Horarios que se ofrecen', id: 'cbs-offered' },
  'c:max': { label: 'Máximo por horario', id: 'cbs-max' },
}

export function errorTarget(key: string): { label: string; id: string } {
  const fixed = FIXED[key]
  if (fixed) return fixed
  const [kind, name, field] = key.split(':')
  if (kind === 'h' && name) return { label: `${DAY_LABELS[name as ChatbotWeekday].long}: horario`, id: `dr-${name}` }
  if (kind === 'r' && name) return { label: `Motivo de ${name}`, id: `r-${name}` }
  if (kind === 's' && name) {
    const subtype = SUBTYPE_COPY[name as ChatbotSettingsSubtype]?.name ?? name
    return { label: `${subtype}: ${field === 'claim' ? 'atender' : 'resolver'}`, id: `s-${name}-${field}` }
  }
  return { label: 'Campo', id: 'cbs-page' }
}

/** Section anchors in page (= PUT) order. */
export const SECTION_IDS = ['hours', 'dates', 'sla', 'extras', 'sched'] as const
