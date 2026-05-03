import { z } from 'zod'

// Strict slug regex: no leading/trailing/consecutive dashes
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const tenantFormSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  slug: z
    .string()
    .min(2, 'El slug debe tener al menos 2 caracteres')
    .regex(SLUG_REGEX, 'El slug solo puede contener minúsculas, números y guiones'),
  address: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
})

export type TenantFormValues = z.infer<typeof tenantFormSchema>

// Backend response
export interface TenantResponse {
  id: string
  name: string
  slug: string
  address?: string
  phone?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Table row (same as response for now)
export interface TenantTableRow extends TenantResponse {}

// Create request
export interface CreateTenantRequest {
  name: string
  slug: string
  address?: string
  phone?: string
}

// Update request
export interface UpdateTenantRequest {
  name?: string
  slug?: string
  address?: string
  phone?: string
  isActive?: boolean
}
