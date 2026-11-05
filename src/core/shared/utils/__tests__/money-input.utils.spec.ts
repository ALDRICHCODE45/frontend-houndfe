import { describe, expect, it } from 'vitest'
import {
  MONEY_INPUT_ERRORS,
  centsToMoneyInput,
  parseDecimalInput,
  parseMoneyInput,
} from '../money-input.utils'

describe('parseMoneyInput', () => {
  it.each([
    ['70.55', 7055],
    ['70,55', 7055],
    ['70,5', 7050],
    ['1,2', 120],
    ['1,234.50', 123450],
    ['1,234', 123400],
    ['12,345', 1234500],
    // A full group of three is always thousands, never a decimal.
    ['70,555', 7055500],
    ['1234,50', 123450],
    ['$1 234.50', 123450],
    ['$\u00A01,234.50', 123450],
    [' 20 ', 2000],
    ['0.29', 29],
    ['0.01', 1],
    ['0', 0],
    ['0,10', 10],
    ['1,234,567.89', 123456789],
  ])('reads %j as %i cents', (text, cents) => {
    expect(parseMoneyInput(text)).toEqual({ cents })
  })

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['$', 'empty'],
    ['0,100', 'comma'],
    ['1,23,4', 'comma'],
    ['1.000,50', 'comma'],
    ['70,5555', 'comma'],
    [',5', 'comma'],
    ['-5', 'format'],
    ['+5', 'format'],
    ['1e2', 'format'],
    ['0x10', 'format'],
    ['abc', 'format'],
    ['Infinity', 'format'],
    ['.5', 'format'],
    ['5.', 'format'],
    ['1.2.3', 'format'],
    ['007', 'format'],
    ['1.005', 'fraction'],
    ['1,234.505', 'fraction'],
  ])('rejects %j (%s)', (text, code) => {
    expect(parseMoneyInput(text)).toEqual({ error: MONEY_INPUT_ERRORS[code as keyof typeof MONEY_INPUT_ERRORS], code })
  })

  it('tells the user to write the cents with a dot when a comma is ambiguous', () => {
    expect(parseMoneyInput('0,100')).toMatchObject({
      error: 'Escribe el monto con punto para los centavos, por ejemplo 70.55.',
    })
  })

  it('rejects a third decimal instead of rounding it', () => {
    expect(parseMoneyInput('0.005')).toMatchObject({ code: 'fraction' })
    expect(parseMoneyInput('10.000')).toMatchObject({ code: 'fraction' })
  })

  it('rejects an amount beyond the safe integer range instead of rounding it', () => {
    expect(parseMoneyInput('99999999999999999999')).toMatchObject({ code: 'range' })
    expect(parseMoneyInput('90071992547409.92')).toMatchObject({ code: 'range' })
  })

  it('honours inclusive minimum and maximum bounds in cents', () => {
    expect(parseMoneyInput('0.01', { minCents: 1 })).toEqual({ cents: 1 })
    expect(parseMoneyInput('0', { minCents: 1 })).toEqual({ error: 'El monto mínimo es $0.01.', code: 'range' })
    expect(parseMoneyInput('100', { maxCents: 10000 })).toEqual({ cents: 10000 })
    expect(parseMoneyInput('100.01', { maxCents: 10000 })).toEqual({ error: 'El monto máximo es $100.00.', code: 'range' })
  })
})

describe('parseDecimalInput', () => {
  it.each([
    ['12.5', 2, '12.5', 1250],
    ['12,5', 2, '12.5', 1250],
    ['100', 2, '100', 10000],
    ['0.29', 2, '0.29', 29],
    ['1,234.5', 2, '1234.5', 123450],
    ['7', 0, '7', 7],
    ['1.234', 3, '1.234', 1234],
  ])('reads %j with %i fraction digits as %j (scaled %i)', (text, maxFractionDigits, value, scaled) => {
    expect(parseDecimalInput(text, { maxFractionDigits })).toEqual({ text: value, scaled })
  })

  it.each([
    ['', 2, 'empty'],
    ['-5', 2, 'format'],
    ['1e2', 2, 'format'],
    ['0,100', 2, 'comma'],
    ['1,23,4', 2, 'comma'],
    ['12.555', 2, 'fraction'],
    ['1.5', 0, 'fraction'],
  ])('rejects %j with %i fraction digits (%s)', (text, maxFractionDigits, code) => {
    expect(parseDecimalInput(text, { maxFractionDigits })).toMatchObject({ code })
  })

  it('words its errors for a number, not an amount of money', () => {
    expect(parseDecimalInput('0,100', { maxFractionDigits: 2 })).toMatchObject({
      error: 'Escribe el número con punto para los decimales, por ejemplo 12.5.',
    })
    expect(parseDecimalInput('12.555', { maxFractionDigits: 2 })).toMatchObject({
      error: 'Usa como máximo 2 decimales.',
    })
  })
})

describe('centsToMoneyInput', () => {
  it.each([
    [7055, '70.55'],
    [123450, '1234.50'],
    [100, '1.00'],
    [5, '0.05'],
    [0, '0.00'],
  ])('prints %i cents as %j', (cents, text) => {
    expect(centsToMoneyInput(cents)).toBe(text)
  })

  it('round-trips with parseMoneyInput', () => {
    for (const cents of [0, 1, 29, 7055, 123450, 2147483647]) {
      expect(parseMoneyInput(centsToMoneyInput(cents))).toEqual({ cents })
    }
  })

  it('refuses a value that is not integer cents', () => {
    expect(() => centsToMoneyInput(1.5)).toThrow()
    expect(() => centsToMoneyInput(-1)).toThrow()
  })
})
