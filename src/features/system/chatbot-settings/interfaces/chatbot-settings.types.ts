/**
 * Chatbot settings API (houndfe-backend `docs/frontend-handoff/16-chatbot-settings.md` at 8c12ae09).
 *
 * `GET /chatbot-settings` and the `PUT` response share one body; the `PUT` request is the same
 * object plus `expectedVersion`. `version`, `recompute`, `updatedBy` and `updatedAt` are read-only: they
 * never travel back to the server (an unknown field is a `400`). Every other key, known or not, is kept
 * in the draft and sent back unchanged: the PUT is a full replacement, so stripping an unknown key would
 * silently delete it. Times are business minutes; instants are UTC ISO strings.
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

// Tolerant on purpose (`passthrough` at every level): a key this screen does not know is kept and sent back
// unchanged on the full-replace PUT. Unknown values of an enumerated field (subtype, weekday) still fail.
const rangeSchema = z.object({ open: z.string(), close: z.string() }).passthrough()
const openingHoursSchema = z
  .object({
    timeZone: z.string(),
    days: z.array(z.object({ day: weekdaySchema, ranges: z.array(rangeSchema) }).passthrough()),
  })
  .passthrough()
const slaSchema = z
  .object({
    subtype: subtypeSchema,
    claimMinutes: z.number().nullable(),
    resolveMinutes: z.number().nullable(),
  })
  .passthrough()
const schedulingSchema = z
  .object({
    enabled: z.boolean(),
    slotMinutes: z.number(),
    slotsOffered: z.number(),
    maxScheduledPerSlot: z.number(),
  })
  .passthrough()
const updatedBySchema = z.object({ id: z.string(), displayName: z.string() }).passthrough()

/** Runtime shape of the `GET` body: drift in a known key throws, an unknown key is kept. */
export const chatbotSettingsSchema = z
  .object({
    version: z.number().int().min(0),
    openingHours: openingHoursSchema,
    closedDates: z.array(z.string()),
    // S11: always present from 7b8cc5f0; defaulted so an older body still loads.
    closedDateReasons: z.record(z.string(), z.string()).default({}),
    slas: z.array(slaSchema),
    windowWarningMinutes: z.number(),
    templateName: z.string().nullable(),
    templateCostText: z.string(),
    enabledSubtypes: z.array(subtypeSchema),
    receiptCloseMarginMinutes: z.number(),
    // Unit 11 (handoff 16): always present from the backend that ships live conversations; defaulted so an older body still loads.
    startTimeoutSeconds: z.number().default(120),
    templateLanguageCode: z.string().default('es_MX'),
    scheduling: schedulingSchema,
    branchOpeningHours: openingHoursSchema.nullable(),
    updatedBy: updatedBySchema.nullable().default(null),
    updatedAt: z.string().nullable().default(null),
  })
  .passthrough()

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

/** Who saved the settings last; `displayName` is a copy made at the save, so it survives the user. */
export interface ChatbotSettingsAuthor {
  id: string
  displayName: string
}

export interface ChatbotSettings {
  /** Read-only. `0` = the branch never saved (defaults). */
  version: number
  openingHours: ChatbotOpeningHours
  closedDates: string[]
  /** Optional text (1 to 80) per closed date, keyed by date; only dates present in `closedDates`. */
  closedDateReasons: Record<string, string>
  slas: ChatbotSla[]
  /** Minutes before the 24 h WhatsApp window closes that the inbox «Ventana por cerrar» filter counts (0 = off). */
  windowWarningMinutes: number
  /** Stored only. `null` = not configured. */
  templateName: string | null
  templateCostText: string
  /** Stored only; this screen never edits it and sends it back untouched. */
  enabledSubtypes: ChatbotSettingsSubtype[]
  receiptCloseMarginMinutes: number
  /** Whole seconds, 30 to 600 (default 120): how long a claim of a live conversation waits for the bot to confirm. Applies to the next claim only. */
  startTimeoutSeconds: number
  /** `xx` or `xx_YY` (default `es_MX`): language of the paid WhatsApp template. */
  templateLanguageCode: string
  scheduling: ChatbotScheduling
  /** Read-only: pickup hours of the same branch, `null` when it has none. */
  branchOpeningHours: ChatbotOpeningHours | null
  /** Read-only. `null` for a branch that never saved. */
  updatedBy: ChatbotSettingsAuthor | null
  /** Read-only, UTC ISO. `null` for a branch that never saved. */
  updatedAt: string | null
}

export type ChatbotRecompute = 'DONE' | 'PARTIAL' | 'FAILED' | 'NOT_NEEDED'

/** `PUT` response: the new `GET` body plus `recompute` (response only). */
export interface ChatbotSettingsSaved extends ChatbotSettings {
  recompute: ChatbotRecompute
}

/** The keys the server answers but never accepts back (an unknown field is a `400`). */
export const READ_ONLY_SETTINGS_KEYS = ['version', 'recompute', 'updatedBy', 'updatedAt'] as const

/**
 * `PUT` body: a full replacement plus the version that was edited. None of the read-only keys. Unknown
 * keys of the `GET` travel back unchanged (hence the index signature). `branchOpeningHours` is accepted
 * and ignored by the server; it is round-tripped only when the `GET` carried one.
 */
export interface ChatbotSettingsPutBody {
  expectedVersion: number
  openingHours: ChatbotOpeningHours
  closedDates: string[]
  closedDateReasons: Record<string, string>
  slas: ChatbotSla[]
  windowWarningMinutes: number
  templateName: string | null
  templateCostText: string
  enabledSubtypes: ChatbotSettingsSubtype[]
  receiptCloseMarginMinutes: number
  startTimeoutSeconds: number
  templateLanguageCode: string
  scheduling: ChatbotScheduling
  branchOpeningHours?: ChatbotOpeningHours
  [unknownKey: string]: unknown
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
