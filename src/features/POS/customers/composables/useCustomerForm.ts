import { reactive } from 'vue'
import { z } from 'zod'
import type {
  CreateCustomerPayload,
  CustomerDetail,
  CustomerFormInput,
  UpdateCustomerPayload,
} from '../interfaces/customer.types'

// ── Select options ─────────────────────────────────────────

export const MEXICO_STATES = [
  'Aguascalientes',
  'Baja California',
  'Baja California Sur',
  'Campeche',
  'Chiapas',
  'Chihuahua',
  'Ciudad de México',
  'Coahuila',
  'Colima',
  'Durango',
  'Estado de México',
  'Guanajuato',
  'Guerrero',
  'Hidalgo',
  'Jalisco',
  'Michoacán',
  'Morelos',
  'Nayarit',
  'Nuevo León',
  'Oaxaca',
  'Puebla',
  'Querétaro',
  'Quintana Roo',
  'San Luis Potosí',
  'Sinaloa',
  'Sonora',
  'Tabasco',
  'Tamaulipas',
  'Tlaxcala',
  'Veracruz',
  'Yucatán',
  'Zacatecas',
] as const

export const MEXICO_STATE_OPTIONS = MEXICO_STATES.map((s) => ({ label: s, value: s }))

export const FISCAL_REGIMES = [
  { label: '601 - General de Ley Personas Morales', value: '601' },
  { label: '603 - Personas Morales con Fines no Lucrativos', value: '603' },
  {
    label: '605 - Sueldos y Salarios e Ingresos Asimilados a Salarios',
    value: '605',
  },
  { label: '606 - Arrendamiento', value: '606' },
  { label: '607 - Régimen de Enajenación o Adquisición de Bienes', value: '607' },
  { label: '608 - Demás ingresos', value: '608' },
  { label: '609 - Consolidación', value: '609' },
  { label: '610 - Residentes en el Extranjero sin EP en México', value: '610' },
  { label: '611 - Ingresos por Dividendos (socios y accionistas)', value: '611' },
  {
    label: '612 - Personas Físicas con Actividades Empresariales y Profesionales',
    value: '612',
  },
  { label: '614 - Ingresos por intereses', value: '614' },
  { label: '615 - Régimen de los ingresos por obtención de premios', value: '615' },
  { label: '616 - Sin obligaciones fiscales', value: '616' },
  { label: '620 - Sociedades Cooperativas de Producción', value: '620' },
  { label: '621 - Incorporación Fiscal', value: '621' },
  {
    label: '622 - Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',
    value: '622',
  },
  { label: '623 - Opcional para Grupos de Sociedades', value: '623' },
  { label: '624 - Coordinados', value: '624' },
  {
    label: '625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
    value: '625',
  },
  { label: '626 - Régimen Simplificado de Confianza', value: '626' },
  { label: '628 - Hidrocarburos', value: '628' },
  { label: '629 - De los Régimenes Fiscales Preferentes y de las EFIS', value: '629' },
  { label: '630 - Enajenación de acciones en bolsa de valores', value: '630' },
] as const

// Common country codes for Latin America + North America
export const COUNTRY_CODES = [
  { code: 'MX', dialCode: '+52', flag: '🇲🇽', name: 'México' },
  { code: 'US', dialCode: '+1', flag: '🇺🇸', name: 'Estados Unidos' },
  { code: 'CA', dialCode: '+1', flag: '🇨🇦', name: 'Canadá' },
  { code: 'CO', dialCode: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: 'AR', dialCode: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: 'CL', dialCode: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: 'PE', dialCode: '+51', flag: '🇵🇪', name: 'Perú' },
  { code: 'BR', dialCode: '+55', flag: '🇧🇷', name: 'Brasil' },
  { code: 'ES', dialCode: '+34', flag: '🇪🇸', name: 'España' },
  { code: 'GT', dialCode: '+502', flag: '🇬🇹', name: 'Guatemala' },
  { code: 'CR', dialCode: '+506', flag: '🇨🇷', name: 'Costa Rica' },
  { code: 'EC', dialCode: '+593', flag: '🇪🇨', name: 'Ecuador' },
  { code: 'VE', dialCode: '+58', flag: '🇻🇪', name: 'Venezuela' },
  { code: 'BO', dialCode: '+591', flag: '🇧🇴', name: 'Bolivia' },
  { code: 'PY', dialCode: '+595', flag: '🇵🇾', name: 'Paraguay' },
  { code: 'UY', dialCode: '+598', flag: '🇺🇾', name: 'Uruguay' },
] as const

export const COUNTRY_CODE_OPTIONS = COUNTRY_CODES.map((c) => ({
  label: `${c.flag} ${c.dialCode}`,
  value: c.dialCode,
}))

// ── Schema ─────────────────────────────────────────────────

export const customerFormSchema = z.object({
  firstName: z
    .string({ required_error: 'El nombre es obligatorio' })
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'Máximo 100 caracteres'),
  lastName: z.string().trim().max(100, 'Máximo 100 caracteres'),
  phoneCountryCode: z.string().trim(),
  phone: z.string().trim().max(30, 'Máximo 30 caracteres'),
  email: z
    .string()
    .trim()
    .max(150, 'Máximo 150 caracteres')
    .refine(
      (val) => val === '' || z.string().email().safeParse(val).success,
      'Ingresá un email válido',
    ),
  comments: z.string().trim().max(2000, 'Máximo 2000 caracteres'),
  assignPriceList: z.boolean(),
  globalPriceListId: z.string().trim(),
  // Billing
  businessName: z.string().trim().max(200, 'Máximo 200 caracteres'),
  fiscalZipCode: z.string().trim().max(10, 'Máximo 10 caracteres'),
  rfc: z.string().trim().max(20, 'Máximo 20 caracteres'),
  fiscalRegime: z.string().trim(),
  billingStreet: z.string().trim().max(200, 'Máximo 200 caracteres'),
  billingExteriorNumber: z.string().trim().max(30, 'Máximo 30 caracteres'),
  billingInteriorNumber: z.string().trim().max(30, 'Máximo 30 caracteres'),
  billingZipCode: z.string().trim().max(10, 'Máximo 10 caracteres'),
  billingNeighborhood: z.string().trim().max(100, 'Máximo 100 caracteres'),
  billingMunicipality: z.string().trim().max(100, 'Máximo 100 caracteres'),
  billingCity: z.string().trim().max(100, 'Máximo 100 caracteres'),
  billingState: z.string().trim(),
  showBillingAddress: z.boolean(),
})

export type CustomerFormValues = z.infer<typeof customerFormSchema>

// ── Helpers ────────────────────────────────────────────────

function getInitialState(): CustomerFormInput {
  return {
    firstName: '',
    lastName: '',
    phoneCountryCode: '+52',
    phone: '',
    email: '',
    comments: '',
    assignPriceList: false,
    globalPriceListId: '',
    // Billing
    businessName: '',
    fiscalZipCode: '',
    rfc: '',
    fiscalRegime: '',
    billingStreet: '',
    billingExteriorNumber: '',
    billingInteriorNumber: '',
    billingZipCode: '',
    billingNeighborhood: '',
    billingMunicipality: '',
    billingCity: '',
    billingState: '',
    showBillingAddress: false,
  }
}

export function customerToFormInput(customer: CustomerDetail): CustomerFormInput {
  return {
    firstName: customer.firstName,
    lastName: customer.lastName ?? '',
    phoneCountryCode: customer.phoneCountryCode ?? '+52',
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    comments: customer.comments ?? '',
    assignPriceList: !!customer.globalPriceListId,
    globalPriceListId: customer.globalPriceListId ?? '',
    // Billing
    businessName: customer.businessName ?? '',
    fiscalZipCode: customer.fiscalZipCode ?? '',
    rfc: customer.rfc ?? '',
    fiscalRegime: customer.fiscalRegime ?? '',
    billingStreet: customer.billingStreet ?? '',
    billingExteriorNumber: customer.billingExteriorNumber ?? '',
    billingInteriorNumber: customer.billingInteriorNumber ?? '',
    billingZipCode: customer.billingZipCode ?? '',
    billingNeighborhood: customer.billingNeighborhood ?? '',
    billingMunicipality: customer.billingMunicipality ?? '',
    billingCity: customer.billingCity ?? '',
    billingState: customer.billingState ?? '',
    showBillingAddress: !!(
      customer.billingStreet ||
      customer.billingCity ||
      customer.billingState
    ),
  }
}

export function toCreatePayload(
  values: CustomerFormValues,
  addresses?: import('../interfaces/customer.types').CreateCustomerAddressPayload[],
): CreateCustomerPayload {
  return {
    firstName: values.firstName,
    ...(values.lastName ? { lastName: values.lastName } : {}),
    ...(values.phoneCountryCode ? { phoneCountryCode: values.phoneCountryCode } : {}),
    ...(values.phone ? { phone: values.phone } : {}),
    ...(values.email ? { email: values.email } : {}),
    ...(values.comments ? { comments: values.comments } : {}),
    ...(values.assignPriceList && values.globalPriceListId
      ? { globalPriceListId: values.globalPriceListId }
      : {}),
    // Billing
    ...(values.businessName ? { businessName: values.businessName } : {}),
    ...(values.fiscalZipCode ? { fiscalZipCode: values.fiscalZipCode } : {}),
    ...(values.rfc ? { rfc: values.rfc } : {}),
    ...(values.fiscalRegime ? { fiscalRegime: values.fiscalRegime } : {}),
    ...(values.showBillingAddress && values.billingStreet
      ? { billingStreet: values.billingStreet }
      : {}),
    ...(values.showBillingAddress && values.billingExteriorNumber
      ? { billingExteriorNumber: values.billingExteriorNumber }
      : {}),
    ...(values.showBillingAddress && values.billingInteriorNumber
      ? { billingInteriorNumber: values.billingInteriorNumber }
      : {}),
    ...(values.showBillingAddress && values.billingZipCode
      ? { billingZipCode: values.billingZipCode }
      : {}),
    ...(values.showBillingAddress && values.billingNeighborhood
      ? { billingNeighborhood: values.billingNeighborhood }
      : {}),
    ...(values.showBillingAddress && values.billingMunicipality
      ? { billingMunicipality: values.billingMunicipality }
      : {}),
    ...(values.showBillingAddress && values.billingCity
      ? { billingCity: values.billingCity }
      : {}),
    ...(values.showBillingAddress && values.billingState
      ? { billingState: values.billingState }
      : {}),
    ...(addresses && addresses.length > 0 ? { addresses } : {}),
  }
}

export function toUpdatePayload(values: CustomerFormValues): UpdateCustomerPayload {
  return {
    firstName: values.firstName,
    ...(values.lastName ? { lastName: values.lastName } : {}),
    ...(values.phoneCountryCode ? { phoneCountryCode: values.phoneCountryCode } : {}),
    ...(values.phone ? { phone: values.phone } : {}),
    ...(values.email ? { email: values.email } : {}),
    ...(values.comments ? { comments: values.comments } : {}),
    globalPriceListId: values.assignPriceList && values.globalPriceListId
      ? values.globalPriceListId
      : undefined,
    // Billing
    ...(values.businessName ? { businessName: values.businessName } : {}),
    ...(values.fiscalZipCode ? { fiscalZipCode: values.fiscalZipCode } : {}),
    ...(values.rfc ? { rfc: values.rfc } : {}),
    ...(values.fiscalRegime ? { fiscalRegime: values.fiscalRegime } : {}),
    ...(values.showBillingAddress && values.billingStreet
      ? { billingStreet: values.billingStreet }
      : {}),
    ...(values.showBillingAddress && values.billingExteriorNumber
      ? { billingExteriorNumber: values.billingExteriorNumber }
      : {}),
    ...(values.showBillingAddress && values.billingInteriorNumber
      ? { billingInteriorNumber: values.billingInteriorNumber }
      : {}),
    ...(values.showBillingAddress && values.billingZipCode
      ? { billingZipCode: values.billingZipCode }
      : {}),
    ...(values.showBillingAddress && values.billingNeighborhood
      ? { billingNeighborhood: values.billingNeighborhood }
      : {}),
    ...(values.showBillingAddress && values.billingMunicipality
      ? { billingMunicipality: values.billingMunicipality }
      : {}),
    ...(values.showBillingAddress && values.billingCity
      ? { billingCity: values.billingCity }
      : {}),
    ...(values.showBillingAddress && values.billingState
      ? { billingState: values.billingState }
      : {}),
  }
}

export function useCustomerForm() {
  const state = reactive<CustomerFormInput>(getInitialState())

  function resetForm() {
    Object.assign(state, getInitialState())
  }

  function setState(nextState: CustomerFormInput) {
    Object.assign(state, nextState)
  }

  return {
    schema: customerFormSchema,
    state,
    resetForm,
    setState,
  }
}
