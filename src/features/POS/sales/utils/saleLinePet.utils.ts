/**
 * Pet of a sale line (handoff 27 §5, §6, §8): the «Para: <nombre>» copy and the draft-route errors.
 * Switches on `error`, never on `message`; a server string is never shown.
 */
import { readApiErrorEnvelope } from '@/core/shared/utils/api-error-envelope'
import type { SaleLinePet, SaleLinePetErrorCode } from '../interfaces/sale.types'

export const PETS_CLEARED_NOTICE = 'Se quitaron las mascotas de las líneas porque cambió el cliente'

/** «Para: Bruno» from the line snapshot (kept even when the pet row is gone). */
export function saleLinePetLabel(pet: SaleLinePet): string {
  return `Para: ${pet.name}`
}

export interface SaleLinePetErrorInfo {
  code: SaleLinePetErrorCode | null
  message: string
  /** The customer's active pets changed under the user: reload the picker list. */
  reloadPets: boolean
  /** The draft changed under the user (the line is gone): refetch the drafts. */
  reloadDraft: boolean
}

const CODE_COPY: Record<SaleLinePetErrorCode, Omit<SaleLinePetErrorInfo, 'code'>> = {
  PET_NOT_FOUND: {
    message: 'Esa mascota ya no existe. Actualizamos la lista.',
    reloadPets: true,
    reloadDraft: false,
  },
  PET_CUSTOMER_MISMATCH: {
    message: 'Esa mascota no es del cliente de esta venta.',
    reloadPets: false,
    reloadDraft: false,
  },
  PET_ARCHIVED: {
    message: 'Esa mascota está archivada. Actualizamos la lista.',
    reloadPets: true,
    reloadDraft: false,
  },
  SALE_ITEM_NOT_FOUND: {
    message: 'Ese producto ya no está en la venta. Actualizamos la venta.',
    reloadPets: false,
    reloadDraft: true,
  },
}

export function readSaleLinePetError(err: unknown): SaleLinePetErrorInfo {
  const code = readApiErrorEnvelope(err).code
  if (code && code in CODE_COPY) {
    const known = code as SaleLinePetErrorCode
    return { code: known, ...CODE_COPY[known] }
  }
  return {
    code: null,
    message: 'No se pudo cambiar la mascota de la línea. Intenta de nuevo.',
    reloadPets: false,
    reloadDraft: false,
  }
}
