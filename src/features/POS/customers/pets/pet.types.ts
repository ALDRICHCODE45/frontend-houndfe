/** Customer pets — handoff 27 §2–§3 (the API source of truth). */

export type PetSpecies = 'DOG' | 'CAT' | 'OTHER'
export type PetSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'GIANT'
export type PetBirthDatePrecision = 'EXACT' | 'MONTH' | 'YEAR'
export type PetStatus = 'ACTIVE' | 'ARCHIVED'
export type PetListStatus = PetStatus | 'ALL'
export type PetCreatedVia = 'POS' | 'CHATBOT'
export type PetWarning = 'PET_NAME_DUPLICATE'

export interface Pet {
  id: string
  customerId: string
  name: string
  species: PetSpecies
  speciesOther: string | null
  breed: string | null
  size: PetSize | null
  birthDate: string | null
  birthDatePrecision: PetBirthDatePrecision | null
  /** Derived by the server; never computed in the client. */
  ageMonths: number | null
  /** Shown as is («~10 meses»). */
  ageLabel: string | null
  allergies: string | null
  notes: string | null
  status: PetStatus
  archivedAt: string | null
  archivedReason: string | null
  createdVia: PetCreatedVia
  version: number
  createdAt: string
  updatedAt: string
}

/** Every write returns the complete pet plus `warnings`. */
export interface PetWriteResponse extends Pet {
  warnings: string[]
}

export interface PetApproxAge {
  years?: number
  months?: number
}

/** `approxAge` or `birthDate` + `birthDatePrecision`, never both. */
export interface CreatePetPayload {
  name: string
  species: PetSpecies
  speciesOther?: string
  breed?: string
  size?: PetSize
  approxAge?: PetApproxAge
  birthDate?: string
  birthDatePrecision?: PetBirthDatePrecision
  allergies?: string
  notes?: string
}

/** Absent = unchanged, `null` clears. */
export interface UpdatePetPayload {
  version: number
  name?: string
  species?: PetSpecies
  speciesOther?: string | null
  breed?: string | null
  size?: PetSize | null
  approxAge?: PetApproxAge
  birthDate?: string | null
  birthDatePrecision?: PetBirthDatePrecision
  allergies?: string | null
  notes?: string | null
}

export interface ArchivePetPayload {
  version: number
  reason?: string
}

export interface RestorePetPayload {
  version: number
}
