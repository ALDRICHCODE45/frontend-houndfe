import { describe, expect, it } from 'vitest'
import {
  extractedDestination,
  extractedOrigin,
  extractedReading,
  generatedNeeds,
  isDestinationMismatch,
  isMismatchFlagged,
  readDestinationCheck,
  readExtracted,
} from '../decision-summary'
import type { ChatbotRequestDecision } from '../../interfaces/chatbot-request.types'

const zone = (overrides: Record<string, unknown> = {}) =>
  ({
    subtype: 'DELIVERY_ZONE',
    validationId: 'v-1',
    zipCode: '55635',
    state: 'Estado de México',
    municipality: 'Zumpango',
    neighborhood: 'San Juan',
    requesterCount: 3,
    lastCustomerMessageAt: null,
    resolution: null,
    ...overrides,
  }) as unknown as ChatbotRequestDecision

const receipt = (overrides: Record<string, unknown> = {}) =>
  ({
    subtype: 'TRANSFER_RECEIPT',
    receiptId: 'r-1',
    saleId: 's-1',
    saleFolio: 'A-202611-000002',
    declaredAmountCents: 17800,
    declaredAmountProvided: true,
    declaredDate: null,
    declaredReference: null,
    saleTotalCents: 17800,
    salePaidCents: 0,
    saleDebtCents: 17800,
    file: null,
    extracted: { amountCents: 17800 },
    mismatch: null,
    resolution: null,
    ...overrides,
  }) as unknown as ChatbotRequestDecision

describe('generatedNeeds — DELIVERY_ZONE', () => {
  it('names the place and how many customers asked', () => {
    expect(generatedNeeds(zone())).toBe(
      'Entrega en CP 55635, Col. San Juan, Zumpango, Estado de México. Lo pidieron 3 clientes.',
    )
  })

  it('says «1 cliente» in singular and leaves out the parts that are missing', () => {
    expect(generatedNeeds(zone({ requesterCount: 1, neighborhood: null, state: '  ' }))).toBe(
      'Entrega en CP 55635, Zumpango. Lo pidió 1 cliente.',
    )
  })

  it('without a requester count only names the place', () => {
    expect(
      generatedNeeds(
        zone({ requesterCount: 0, municipality: null, state: null, neighborhood: null }),
      ),
    ).toBe('Entrega en CP 55635.')
  })
})

describe('generatedNeeds — TRANSFER_RECEIPT', () => {
  it('names the sale, its total and debt, what the customer declared and what the image says', () => {
    expect(
      generatedNeeds(receipt({ declaredAmountCents: 20000, extracted: { amountCents: 17800 } })),
    ).toBe(
      'Revisar comprobante de la venta A-202611-000002: total $178.00, debe $178.00, el cliente declaró $200.00, la imagen dice $178.00.',
    )
  })

  it('leaves out «declaró» when the customer gave no amount and «la imagen dice» without a reading', () => {
    expect(
      generatedNeeds(
        receipt({ declaredAmountProvided: false, declaredAmountCents: 0, extracted: null }),
      ),
    ).toBe('Revisar comprobante de la venta A-202611-000002: total $178.00, debe $178.00.')
  })

  it('without a folio says «la venta» and ignores an amount the image reading does not carry', () => {
    expect(
      generatedNeeds(
        receipt({ saleFolio: null, declaredAmountProvided: false, extracted: { bank: 'BBVA' } }),
      ),
    ).toBe('Revisar comprobante de la venta: total $178.00, debe $178.00.')
  })
})

describe('generatedNeeds — other subtypes', () => {
  it('returns null for every other subtype and without a decision', () => {
    expect(generatedNeeds({ subtype: 'RESTOCK' } as unknown as ChatbotRequestDecision)).toBeNull()
    expect(generatedNeeds(null)).toBeNull()
    expect(generatedNeeds(undefined)).toBeNull()
  })
})

describe('readExtracted', () => {
  it('keeps only well-typed fields', () => {
    expect(
      readExtracted({
        amountCents: 17800,
        date: '2026-11-16',
        reference: '167050',
        bank: 'BanCoppel',
        confidence: 0.9,
        x: 1,
      }),
    ).toEqual({
      amountCents: 17800,
      date: '2026-11-16',
      reference: '167050',
      bank: 'BanCoppel',
      confidence: 0.9,
    })
    expect(readExtracted({ amountCents: '178', confidence: 2, bank: '' })).toBeNull()
    expect(readExtracted(null)).toBeNull()
    expect(readExtracted('x')).toBeNull()
  })
})

describe('extractedReading', () => {
  it('reads amount · bank · ref · date · confidence', () => {
    expect(
      extractedReading({
        amountCents: 17800,
        bank: 'BanCoppel',
        reference: '167050',
        date: '2026-11-16',
        confidence: 0.9,
      }),
    ).toBe('$178.00 · BanCoppel · ref. 167050 · 16 nov 2026 · confianza 90 %')
  })

  it('leaves out what the reading does not carry, and is null with nothing to show', () => {
    expect(extractedReading({ amountCents: 17800 })).toBe('$178.00')
    expect(extractedReading({ bank: 'BBVA', confidence: 0.456 })).toBe('BBVA · confianza 46 %')
    expect(extractedReading(null)).toBeNull()
    expect(extractedReading({})).toBeNull()
  })
})

describe('isMismatchFlagged', () => {
  it('is true only for the backend object with flagged true', () => {
    expect(isMismatchFlagged({ debtCents: 17800, declaredDiffCents: 2200, flagged: true })).toBe(
      true,
    )
    expect(isMismatchFlagged({ debtCents: 17800, flagged: false })).toBe(false)
    expect(isMismatchFlagged(true)).toBe(false)
    expect(isMismatchFlagged(null)).toBe(false)
    expect(isMismatchFlagged({ weird: true })).toBe(false)
  })
})

describe('readExtracted — destination fields (handoff 22)', () => {
  it('keeps the destination and origin fields when well-typed', () => {
    expect(
      readExtracted({
        destinationBank: ' BBVA MEXICO ',
        destinationName: 'Abril Alejandra Vazquez Ramos',
        destinationAccountLast4: '9616',
        originName: 'Juan Pérez',
      }),
    ).toEqual({
      destinationBank: 'BBVA MEXICO',
      destinationName: 'Abril Alejandra Vazquez Ramos',
      destinationAccountLast4: '9616',
      originName: 'Juan Pérez',
    })
  })

  it('ignores hostile or garbage values', () => {
    expect(
      readExtracted({
        destinationBank: 42,
        destinationName: '   ',
        destinationAccountLast4: '96a6',
        originName: { name: 'x' },
      }),
    ).toBeNull()
    expect(readExtracted({ destinationAccountLast4: 9616 })).toBeNull()
    expect(readExtracted({ destinationAccountLast4: '123456' })).toBeNull()
    expect(readExtracted({ destinationName: 'x'.repeat(121) })).toBeNull()
    expect(readExtracted({ destinationBank: 'x'.repeat(81) })).toBeNull()
    expect(readExtracted({ originName: 'x'.repeat(121) })).toBeNull()
  })
})

describe('extractedDestination / extractedOrigin', () => {
  it('reads beneficiary · bank · masked account, and the payer', () => {
    const value = {
      destinationBank: 'BBVA MEXICO',
      destinationName: 'Abril Vazquez',
      destinationAccountLast4: '9616',
      originName: 'Juan Pérez',
    }
    expect(extractedDestination(value)).toBe(
      'Beneficiario: Abril Vazquez · Banco destino: BBVA MEXICO · Cuenta destino: ****9616',
    )
    expect(extractedOrigin(value)).toBe('Ordenante: Juan Pérez')
  })

  it('omits the missing parts and is null with nothing to show', () => {
    expect(extractedDestination({ destinationAccountLast4: '9616' })).toBe(
      'Cuenta destino: ****9616',
    )
    expect(extractedDestination({ destinationBank: 'BBVA', destinationAccountLast4: 'abcd' })).toBe(
      'Banco destino: BBVA',
    )
    expect(extractedDestination({ amountCents: 100 })).toBeNull()
    expect(extractedDestination(null)).toBeNull()
    expect(extractedOrigin({ destinationName: 'Abril' })).toBeNull()
    expect(extractedOrigin('x')).toBeNull()
  })

  it('the amount reading does not repeat the destination data', () => {
    expect(extractedReading({ amountCents: 17800, destinationBank: 'BBVA' })).toBe('$178.00')
    expect(extractedReading({ destinationBank: 'BBVA' })).toBeNull()
  })
})

describe('readDestinationCheck / isDestinationMismatch', () => {
  it('passes match and mismatch through and reads anything else as unknown', () => {
    expect(readDestinationCheck('match')).toBe('match')
    expect(readDestinationCheck('mismatch')).toBe('mismatch')
    expect(readDestinationCheck('unknown')).toBe('unknown')
    expect(readDestinationCheck(undefined)).toBe('unknown')
    expect(readDestinationCheck(null)).toBe('unknown')
    expect(readDestinationCheck('MISMATCH')).toBe('unknown')
    expect(readDestinationCheck({ value: 'mismatch' })).toBe('unknown')
  })

  it('is a mismatch only for the exact value', () => {
    expect(isDestinationMismatch('mismatch')).toBe(true)
    expect(isDestinationMismatch('match')).toBe(false)
    expect(isDestinationMismatch('unknown')).toBe(false)
    expect(isDestinationMismatch(undefined)).toBe(false)
    expect(isDestinationMismatch(true)).toBe(false)
  })
})

describe('generatedNeeds — TRANSFER_RECEIPT destination', () => {
  it('does not change with the destination check (staff hint only, shown as its own alert)', () => {
    expect(generatedNeeds(receipt({ destinationCheck: 'mismatch' }))).toBe(
      'Revisar comprobante de la venta A-202611-000002: total $178.00, debe $178.00, el cliente declaró $178.00, la imagen dice $178.00.',
    )
  })
})
