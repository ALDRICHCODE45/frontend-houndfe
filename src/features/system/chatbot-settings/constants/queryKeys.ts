/** Tenant-scoped keys: a branch switch never reuses another branch's settings (the branch comes from the JWT). */
export const chatbotSettingsKeys = {
  all: (tenantId: string) => ['chatbot-settings', tenantId] as const,
  detail: (tenantId: string) => ['chatbot-settings', tenantId, 'detail'] as const,
}
