import {
  CHATBOT_WEEKDAYS,
  type ChatbotOpeningHours,
  type ChatbotSettings,
  type ChatbotSla,
} from '../chatbot-settings.types'

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export function week(
  ranges: Partial<Record<(typeof CHATBOT_WEEKDAYS)[number], Array<[string, string]>>> = {},
  timeZone = 'America/Mexico_City',
): ChatbotOpeningHours {
  return {
    timeZone,
    days: CHATBOT_WEEKDAYS.map((day) => ({
      day,
      ranges: (ranges[day] ?? []).map(([open, close]) => ({ open, close })),
    })),
  }
}

const FULL: Array<[string, string]> = [['09:00', '19:00']]

export const slas = (): ChatbotSla[] => [
  { subtype: 'RESTOCK', claimMinutes: 60, resolveMinutes: 240 },
  { subtype: 'EXPIRATION', claimMinutes: 60, resolveMinutes: 240 },
  { subtype: 'DELIVERY_ZONE', claimMinutes: 60, resolveMinutes: 240 },
  { subtype: 'TRANSFER_RECEIPT', claimMinutes: null, resolveMinutes: null },
  { subtype: 'TALK_TO_HUMAN', claimMinutes: 10, resolveMinutes: null },
  { subtype: 'COMPLAINT', claimMinutes: 30, resolveMinutes: 240 },
  { subtype: 'UNKNOWN_QUESTION', claimMinutes: 30, resolveMinutes: 120 },
  { subtype: 'DISCOUNT', claimMinutes: 30, resolveMinutes: 120 },
]

/** A saved branch (version 3), with a pickup schedule and a restricted `enabledSubtypes`. */
export function settingsFixture(over: Partial<ChatbotSettings> = {}): ChatbotSettings {
  return {
    version: 3,
    openingHours: week({
      MONDAY: FULL,
      TUESDAY: FULL,
      WEDNESDAY: [
        ['09:00', '14:00'],
        ['16:00', '19:00'],
      ],
      THURSDAY: FULL,
      FRIDAY: FULL,
      SATURDAY: [['09:00', '14:00']],
    }),
    closedDates: ['2026-09-16', '2026-12-25', '2027-01-01'],
    closedDateReasons: {},
    slas: slas(),
    windowWarningMinutes: 120,
    templateName: null,
    templateCostText: 'Enviar la plantilla tiene un costo para el negocio.',
    enabledSubtypes: ['RESTOCK', 'COMPLAINT'],
    receiptCloseMarginMinutes: 60,
    startTimeoutSeconds: 120,
    templateLanguageCode: 'es_MX',
    scheduling: { enabled: false, slotMinutes: 30, slotsOffered: 3, maxScheduledPerSlot: 3 },
    branchOpeningHours: week({ MONDAY: [['10:00', '18:00']], TUESDAY: [['10:00', '18:00']] }),
    updatedBy: null,
    updatedAt: null,
    ...over,
  }
}

/** What a branch that never saved answers (`version: 0`). */
export function defaultsFixture(): ChatbotSettings {
  return settingsFixture({
    version: 0,
    closedDates: [],
    openingHours: week({
      MONDAY: FULL,
      TUESDAY: FULL,
      WEDNESDAY: FULL,
      THURSDAY: FULL,
      FRIDAY: FULL,
      SATURDAY: FULL,
    }),
    enabledSubtypes: [
      'RESTOCK',
      'EXPIRATION',
      'DELIVERY_ZONE',
      'TRANSFER_RECEIPT',
      'TALK_TO_HUMAN',
      'COMPLAINT',
      'UNKNOWN_QUESTION',
      'DISCOUNT',
    ],
    branchOpeningHours: null,
  })
}
