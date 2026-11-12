/** es-MX copy of the inbox list states (design 01-tabla-agrupada `stateHTML`). */
import type { RequestsListTab } from './list-query'

export interface EmptyCopy {
  title: string
  description: string
}

const EMPTY: Record<RequestsListTab, EmptyCopy> = {
  open: {
    title: 'No hay solicitudes abiertas',
    description: 'Cuando el chatbot necesite a una persona, la solicitud aparece aquí.',
  },
  scheduled: {
    title: 'No hay solicitudes agendadas',
    description: 'Las conversaciones que se agenden para más tarde aparecen aquí.',
  },
  resolved: {
    title: 'No hay solicitudes resueltas en los últimos 7 días',
    description: 'Las que se resuelvan aparecen aquí durante una semana; después pasan al historial.',
  },
  cancelled: {
    title: 'No hay solicitudes canceladas en los últimos 7 días',
    description: 'Las que se cancelen aparecen aquí durante una semana; después pasan al historial.',
  },
  history: {
    title: 'Todavía no hay solicitudes en el historial',
    description: 'Aquí aparecen las solicitudes cerradas hace más de 7 días.',
  },
}

export const emptyCopy = (tab: RequestsListTab): EmptyCopy => EMPTY[tab]

export const noMatchTitle = (q: string): string => `Sin resultados para «${q.trim() || 'estos filtros'}»`
