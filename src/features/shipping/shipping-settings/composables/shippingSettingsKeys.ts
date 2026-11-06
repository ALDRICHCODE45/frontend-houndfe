/** Query keys of the Envíos settings, one branch per tenant. */
export const shippingSettingsKeys = {
  all: ['shipping-settings'] as const,
  boxes: (tenantId: string) => ['shipping-settings', tenantId, 'boxes'] as const,
  origin: (tenantId: string) => ['shipping-settings', tenantId, 'origin'] as const,
  openingHours: (tenantId: string) => ['shipping-settings', tenantId, 'opening-hours'] as const,
}
