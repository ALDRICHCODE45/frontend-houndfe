/**
 * Chatbot settings API (houndfe-backend `docs/frontend-handoff/16-chatbot-settings.md` at 8c12ae09).
 *
 * `GET /chatbot-settings` and the `PUT` response share one body; the `PUT` request is the same
 * object without `version` and `branchOpeningHours`' read-only role, plus `expectedVersion`.
 * `version` and `recompute` are read-only: they never travel back to the server (an unknown
 * field is a `400`). Times are business minutes; instants are UTC ISO strings (none on this screen).
 */
import { z } from 'zod'

export const CHATBOT_WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const
export type ChatbotWeekday = (typeof CHATBOT_WEEKDAYS)[number]

/** The eight request subtypes, in the order the API always returns them (§3). */
export const CHATBOT_SETTINGS_SUBTYPES = [
  'RESTOCK',
  'EXPIRATION',
  'DELIVERY_ZONE',
  'TRANSFER_RECEIPT',
  'TALK_TO_HUMAN',
  'COMPLAINT',
  'UNKNOWN_QUESTION',
  'DISCOUNT',
] as const
export type ChatbotSettingsSubtype = (typeof CHATBOT_SETTINGS_SUBTYPES)[number]

const weekdaySchema = z.enum(CHATBOT_WEEKDAYS)
const subtypeSchema = z.enum(CHATBOT_SETTINGS_SUBTYPES)

const rangeSchema = z.object({ open: z.string(), close: z.string() })
const openingHoursSchema = z.object({
  timeZone: z.string(),
  days: z.array(z.object({ day: weekdaySchema, ranges: z.array(rangeSchema) })),
})
const slaSchema = z.object({
  subtype: subtypeSchema,
  claimMinutes: z.number().nullable(),
  resolveMinutes: z.number().nullable(),
})
const schedulingSchema = z.object({
  enabled: z.boolean(),
  slotMinutes: z.number(),
  slotsOffered: z.number(),
  maxScheduledPerSlot: z.number(),
})

/** Runtime shape of the `GET` body (unknown fields are stripped, a drift in the known ones throws). */
export const chatbotSettingsSchema = z.object({
  version: z.number().int().min(0),
  openingHours: openingHoursSchema,
  closedDates: z.array(z.string()),
  slas: z.array(slaSchema),
  windowWarningMinutes: z.number(),
  templateName: z.string().nullable(),
  templateCostText: z.string(),
  enabledSubtypes: z.array(subtypeSchema),
  receiptCloseMarginMinutes: z.number(),
  scheduling: schedulingSchema,
  branchOpeningHours: openingHoursSchema.nullable(),
})

export const chatbotRecomputeSchema = z.enum(['DONE', 'PARTIAL', 'FAILED', 'NOT_NEEDED'])

export const chatbotSettingsSavedSchema = chatbotSettingsSchema.extend({
  recompute: chatbotRecomputeSchema,
})

export interface ChatbotOpeningRange {
  /** `HH:mm`. */
  open: string
  /** `HH:mm`, latest `23:59`. */
  close: string
}
export interface ChatbotOpeningDay {
  day: ChatbotWeekday
  ranges: ChatbotOpeningRange[]
}
/** `OpeningHoursBody`: seven days, IANA time zone. */
export interface ChatbotOpeningHours {
  timeZone: string
  days: ChatbotOpeningDay[]
}
/** `null` is «no deadline of this kind». */
export interface ChatbotSla {
  subtype: ChatbotSettingsSubtype
  claimMinutes: number | null
  resolveMinutes: number | null
}
/** Stored only today (unit 14 gives them effect). */
export interface ChatbotScheduling {
  enabled: boolean
  slotMinutes: number
  slotsOffered: number
  maxScheduledPerSlot: number
}

export interface ChatbotSettings {
  /** Read-only. `0` = the branch never saved (defaults). */
  version: number
  openingHours: ChatbotOpeningHours
  closedDates: string[]
  slas: ChatbotSla[]
  /** Stored only: the inbox filter keeps its own 2 h. */
  windowWarningMinutes: number
  /** Stored only. `null` = not configured. */
  templateName: string | null
  templateCostText: string
  /** Stored only; this screen never edits it and sends it back untouched. */
  enabledSubtypes: ChatbotSettingsSubtype[]
  receiptCloseMarginMinutes: number
  scheduling: ChatbotScheduling
  /** Read-only: pickup hours of the same branch, `null` when it has none. */
  branchOpeningHours: ChatbotOpeningHours | null
}

export type ChatbotRecompute = 'DONE' | 'PARTIAL' | 'FAILED' | 'NOT_NEEDED'

/** `PUT` response: the new `GET` body plus `recompute` (response only). */
export interface ChatbotSettingsSaved extends ChatbotSettings {
  recompute: ChatbotRecompute
}

/**
 * `PUT` body: a full replacement plus the version that was edited. No `version`, no `recompute`.
 * `branchOpeningHours` is accepted and ignored by the server; it is round-tripped only when the
 * `GET` carried one.
 */
export interface ChatbotSettingsPutBody {
  expectedVersion: number
  openingHours: ChatbotOpeningHours
  closedDates: string[]
  slas: ChatbotSla[]
  windowWarningMinutes: number
  templateName: string | null
  templateCostText: string
  enabledSubtypes: ChatbotSettingsSubtype[]
  receiptCloseMarginMinutes: number
  scheduling: ChatbotScheduling
  branchOpeningHours?: ChatbotOpeningHours
}

/** `POST /chatbot-settings/apply-to-all-tenants` body; both fields optional. */
export interface ChatbotApplyBody {
  dryRun?: boolean
  expectedVersion?: number
}

export type ChatbotApplySkipReason = 'NO_PERMISSION' | 'TENANT_INACTIVE'

export interface ChatbotApplyTenant {
  tenantId: string
  name: string
}
export interface ChatbotApplyApplied extends ChatbotApplyTenant {
  /** Absent on a dry run. */
  recompute?: Exclude<ChatbotRecompute, 'NOT_NEEDED'>
}
export interface ChatbotApplySkipped extends ChatbotApplyTenant {
  reason: ChatbotApplySkipReason
}

/** Every branch you belong to appears in exactly one list (§5). */
export interface ChatbotApplyResult {
  dryRun: boolean
  source: { tenantId: string; version: number }
  tenantsApplied: ChatbotApplyApplied[]
  tenantsUnchanged: ChatbotApplyTenant[]
  tenantsSkipped: ChatbotApplySkipped[]
  tenantsFailed: ChatbotApplyTenant[]
}

export const chatbotApplyResultSchema = z.object({
  dryRun: z.boolean(),
  source: z.object({ tenantId: z.string(), version: z.number() }),
  tenantsApplied: z.array(
    z.object({
      tenantId: z.string(),
      name: z.string(),
      recompute: z.enum(['DONE', 'PARTIAL', 'FAILED']).optional(),
    }),
  ),
  tenantsUnchanged: z.array(z.object({ tenantId: z.string(), name: z.string() })),
  tenantsSkipped: z.array(
    z.object({
      tenantId: z.string(),
      name: z.string(),
      reason: z.enum(['NO_PERMISSION', 'TENANT_INACTIVE']),
    }),
  ),
  tenantsFailed: z.array(z.object({ tenantId: z.string(), name: z.string() })),
})
