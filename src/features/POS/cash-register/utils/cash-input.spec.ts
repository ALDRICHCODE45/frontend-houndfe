import { describe, expect, it } from 'vitest'
import {
  centsToPesosInput,
  commandAttempt,
  countPayload,
  countQuantity,
  denominationCentsFromPesos,
  integerCents,
  MAX_CASH_MONEY_CENTS,
  MAX_CASH_QUANTITY,
  pesosToCents,
} from './cash-input'

describe('cash input contract', () => {
  it('distinguishes an empty amount from an explicitly counted zero', () => {
    expect(() => integerCents('')).toThrow('Ingresa centavos enteros; cero debe ser explícito.')
    expect(integerCents('0')).toBe(0)
    expect(integerCents('2147483647')).toBe(2147483647)
    for (const value of ['-1', '1.5', '1e2', '2147483648']) {
      expect(() => integerCents(value)).toThrow(/centavos enteros|fuera de rango/)
    }
  })
  it('requires every frozen channel exactly once without expected values in the body', () => {
    const channels = [{ channelKey: 'CASH', channelLabel: 'Efectivo', method: 'CASH' as const }]
    expect(() => countPayload(channels, {})).toThrow(
      'Ingresa centavos enteros; cero debe ser explícito.',
    )
    expect(() => countPayload([], {})).toThrow('No hay canales congelados válidos para contar.')
    expect(countPayload(channels, { CASH: '0' })).toEqual({
      lines: [{ channelKey: 'CASH', amountCents: 0 }],
    })
  })
  it('reuses a key for identical retries but creates a new key for changed commands', () => {
    let next = 0
    const attempt = commandAttempt(() => `key-${++next}`)
    expect(attempt.key('POST:/a', { amountCents: 0 })).toBe('key-1')
    expect(attempt.key('POST:/a', { amountCents: 0 })).toBe('key-1')
    expect(attempt.key('POST:/a', { amountCents: 1 })).toBe('key-2')
    attempt.reset()
    expect(attempt.key('POST:/a', { amountCents: 1 })).toBe('key-3')
  })
})

describe('cash money in pesos — exact decimal to integer cents', () => {
  it('converts representative pesos exactly, with no float rounding', () => {
    expect(pesosToCents('350')).toBe(35000)
    expect(pesosToCents('0.01')).toBe(1)
    expect(pesosToCents('0.1')).toBe(10)
    expect(pesosToCents('0.10')).toBe(10)
    expect(pesosToCents('1234.56')).toBe(123456)
    expect(pesosToCents('  75.5  ')).toBe(7550)
  })

  it('keeps an explicit zero distinct from a blank amount', () => {
    expect(pesosToCents('0')).toBe(0)
    expect(pesosToCents('0.00')).toBe(0)
    expect(() => pesosToCents('')).toThrow(/cero debe ser explícito/i)
    expect(() => pesosToCents('   ')).toThrow(/cero debe ser explícito/i)
  })

  it('rejects a fraction beyond two decimals instead of silently rounding', () => {
    for (const value of ['1.234', '0.005', '1.9999', '10.000']) {
      expect(() => pesosToCents(value)).toThrow(/inválido/i)
    }
  })

  it('rejects negative, signed, exponent and non-finite input', () => {
    for (const value of ['-1', '-0.01', '+1', '1e2', '1E2', 'Infinity', 'NaN', '.5', '5.']) {
      expect(() => pesosToCents(value)).toThrow(
        'Importe inválido: usa pesos con hasta dos decimales, sin signos ni exponentes.',
      )
    }
  })

  it('accepts the money boundary and rejects one cent over it', () => {
    expect(pesosToCents('21474836.47')).toBe(MAX_CASH_MONEY_CENTS)
    expect(() => pesosToCents('21474836.48')).toThrow(/fuera de rango/i)
  })

  it('honours an explicit narrower per-field bound', () => {
    expect(pesosToCents('100.00', { maxCents: 10000 })).toBe(10000)
    expect(pesosToCents('100', { maxCents: 10000 })).toBe(10000)
    expect(pesosToCents('99.99', { maxCents: 10000 })).toBe(9999)
    expect(() => pesosToCents('100.01', { maxCents: 10000 })).toThrow(/fuera de rango/i)
  })

  it('rejects an unsafe cents target instead of rounding it into range', () => {
    expect(() => pesosToCents('90071992547409.92')).toThrow(/fuera de rango/i)
    expect(() => pesosToCents('99999999999999999999')).toThrow(/fuera de rango/i)
  })

  it('accepts a comma decimal separator only with at most two decimals', () => {
    expect(pesosToCents('350,50')).toBe(35050)
    expect(pesosToCents('0,01')).toBe(1)
    expect(() => pesosToCents('1,000')).toThrow(/inválido/i)
    expect(() => pesosToCents('1.000,50')).toThrow(/inválido/i)
  })
})

describe('cash money — cents to editable pesos', () => {
  it('formats integer cents as exact editable pesos', () => {
    expect(centsToPesosInput(0)).toBe('0.00')
    expect(centsToPesosInput(1)).toBe('0.01')
    expect(centsToPesosInput(35000)).toBe('350.00')
    expect(centsToPesosInput(2147483647)).toBe('21474836.47')
  })

  it('round-trips a DEFAULT FLOAT amount once without drift', () => {
    const defaultFloatCents = 35000
    const editable = centsToPesosInput(defaultFloatCents)
    expect(editable).toBe('350.00')
    expect(pesosToCents(editable)).toBe(defaultFloatCents)
  })

  it('refuses to format a non-integer, negative or non-finite cents value', () => {
    for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => centsToPesosInput(value)).toThrow('Valor de centavos inválido.')
    }
  })
})

describe('cash input errors use neutral Mexican Spanish', () => {
  it('keeps money and piece-count guidance explicit without Argentine voseo', () => {
    expect(() => pesosToCents('')).toThrow(
      'Ingresa el importe en pesos (el cero debe ser explícito).',
    )
    expect(() => pesosToCents('1.234')).toThrow(
      'Importe inválido: usa pesos con hasta dos decimales, sin signos ni exponentes.',
    )
    expect(() => countQuantity('')).toThrow(
      'Ingresa una cantidad entera de piezas (el cero debe ser explícito).',
    )
    expect(() => countQuantity('1.5')).toThrow(
      'Cantidad inválida: usa un número entero de piezas, sin decimales.',
    )
    expect(pesosToCents('0')).toBe(0)
    expect(pesosToCents('350.50')).toBe(35050)
    expect(countQuantity('0')).toBe(0)
    expect(countQuantity('12')).toBe(12)
  })
})

describe('cash counts are integer quantities, not money', () => {
  it('parses a denomination quantity as an integer count with count units', () => {
    expect(countQuantity('0')).toBe(0)
    expect(countQuantity('12')).toBe(12)
    expect(countQuantity('2147483647')).toBe(MAX_CASH_QUANTITY)
    expect(() => countQuantity('2147483648')).toThrow(/cantidad/i)
    expect(() => countQuantity('1.5')).toThrow(/cantidad/i)
    expect(() => countQuantity('-1')).toThrow(/cantidad/i)
    expect(() => countQuantity('')).toThrow(/cantidad/i)
    expect(() => countQuantity('  ')).toThrow(/cantidad/i)
  })

  it('parses denomination money in pesos with the unchanged minimum of one cent', () => {
    expect(denominationCentsFromPesos('0.01')).toBe(1)
    expect(denominationCentsFromPesos('50.00')).toBe(5000)
    expect(() => denominationCentsFromPesos('0')).toThrow(/fuera de rango/i)
    expect(() => denominationCentsFromPesos('0.00')).toThrow(/fuera de rango/i)
    expect(() => denominationCentsFromPesos('21474836.48')).toThrow(/fuera de rango/i)
  })
})
