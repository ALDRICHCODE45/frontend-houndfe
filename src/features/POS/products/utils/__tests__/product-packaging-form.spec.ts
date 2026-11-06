import { describe, expect, it } from 'vitest'
import {
  emptyPackagingForm,
  formatPackagingSize,
  formatPackagingWeight,
  packagingErrorMessages,
  packagingToForm,
  readPackagingForm,
} from '../product-packaging-form'

const filled = { weightKg: '1.25', lengthCm: '20.5', widthCm: '12', heightCm: '8.3' }

describe('readPackagingForm — S4 kg/cm typed, grams/cm sent', () => {
  it('converts kg to integer grams and keeps cm with one decimal', () => {
    expect(readPackagingForm(filled)).toEqual({
      body: { weightG: 1250, lengthCm: 20.5, widthCm: 12, heightCm: 8.3 },
      errors: {},
    })
  })

  it('accepts a decimal comma and avoids float drift (0.45 kg → 450 g, 1,005 kg → 1005 g)', () => {
    expect(readPackagingForm({ ...filled, weightKg: '0.45' }).body?.weightG).toBe(450)
    expect(readPackagingForm({ ...filled, weightKg: '1,005', lengthCm: '20,5' }).body).toMatchObject({
      weightG: 1005,
      lengthCm: 20.5,
    })
  })

  it('requires all four fields, each with its own message', () => {
    const result = readPackagingForm(emptyPackagingForm())
    expect(result.body).toBeNull()
    expect(result.errors).toEqual({
      weightG: 'Escribe el peso.',
      lengthCm: 'Escribe el largo.',
      widthCm: 'Escribe el ancho.',
      heightCm: 'Escribe el alto.',
    })
  })

  it('rejects weights outside 1..70000 g or finer than a gram', () => {
    for (const weightKg of ['0', '70.001', '-1']) {
      expect(readPackagingForm({ ...filled, weightKg }).errors.weightG).toBe('El peso va de 0.001 a 70 kg.')
    }
    expect(readPackagingForm({ ...filled, weightKg: '1.2345' }).errors.weightG).toBe(
      'Usa hasta 3 decimales: el peso se guarda en gramos.',
    )
    expect(readPackagingForm({ ...filled, weightKg: 'abc' }).errors.weightG).toBe(
      'Escribe el peso en kg, por ejemplo 1.25.',
    )
    expect(readPackagingForm({ ...filled, weightKg: '70' }).body?.weightG).toBe(70000)
    expect(readPackagingForm({ ...filled, weightKg: '0.001' }).body?.weightG).toBe(1)
  })

  it('rejects sizes outside 0.1..300 cm or with more than one decimal', () => {
    for (const lengthCm of ['0', '300.1', '-1']) {
      expect(readPackagingForm({ ...filled, lengthCm }).errors.lengthCm).toBe('El largo va de 0.1 a 300 cm.')
    }
    expect(readPackagingForm({ ...filled, widthCm: '10.25' }).errors.widthCm).toBe('Usa un decimal como máximo.')
    expect(readPackagingForm({ ...filled, heightCm: 'x' }).errors.heightCm).toBe(
      'Escribe el alto en cm, por ejemplo 8.5.',
    )
    expect(readPackagingForm({ ...filled, lengthCm: '300', widthCm: '0.1' }).body).toMatchObject({
      lengthCm: 300,
      widthCm: 0.1,
    })
  })
})

describe('packagingToForm and display', () => {
  const record = { weightG: 3150, lengthCm: 35, widthCm: 22, heightCm: 10, updatedAt: 'x' }

  it('prefills the form in kg and cm', () => {
    expect(packagingToForm(record)).toEqual({ weightKg: '3.15', lengthCm: '35', widthCm: '22', heightCm: '10' })
    expect(packagingToForm(null)).toEqual(emptyPackagingForm())
  })

  it('shows weight in kg and the size as L × A × H cm', () => {
    expect(formatPackagingWeight(3150)).toBe('3.15 kg')
    expect(formatPackagingWeight(45)).toBe('0.045 kg')
    expect(formatPackagingSize({ lengthCm: 20.5, widthCm: 7, heightCm: 5.5 })).toBe('20.5 × 7 × 5.5 cm')
  })
})

describe('packagingErrorMessages — backend errors in Spanish (S6)', () => {
  const axiosError = (status: number, data: unknown) => ({ isAxiosError: true, response: { status, data } })

  it('maps 404 ENTITY_NOT_FOUND to the product or the variant, never the English text', () => {
    const notFound = axiosError(404, {
      statusCode: 404,
      error: 'ENTITY_NOT_FOUND',
      message: 'Product with id "6f1c" not found',
      timestamp: 't',
    })
    expect(packagingErrorMessages(notFound, 'product')).toEqual({
      fields: {},
      message: 'Este producto ya no existe en la sucursal. Recarga la página.',
    })
    expect(packagingErrorMessages(notFound, 'variant').message).toBe(
      'Esta variante ya no existe en este producto. Recarga la página.',
    )
  })

  it('routes 400 constraints to the field that caused them', () => {
    const invalid = axiosError(400, {
      statusCode: 400,
      error: 'Bad Request',
      message: [
        { property: 'weightG', children: [], constraints: { max: 'weightG must not be greater than 70000' } },
        { property: 'heightCm', children: [], constraints: { maxDecimalPlaces: 'heightCm must have at most 1 decimal' } },
      ],
    })
    const result = packagingErrorMessages(invalid, 'product')
    expect(result.fields).toEqual({
      weightG: 'El peso va de 0.001 a 70 kg.',
      heightCm: 'Revisa el alto: va de 0.1 a 300 cm, con un decimal como máximo.',
    })
    expect(result.message).toBe('Revisa los datos marcados.')
    expect(JSON.stringify(result)).not.toMatch(/must|greater|decimal place/)
  })

  it('says a 400 without a known field, a 403 and any other failure in Spanish', () => {
    expect(
      packagingErrorMessages(axiosError(400, { statusCode: 400, error: 'Bad Request', message: 'Validation failed (uuid is expected)' }), 'variant').message,
    ).toBe('No se pudo guardar el empaque. Recarga la página e intenta de nuevo.')
    expect(
      packagingErrorMessages(axiosError(403, { statusCode: 403, error: 'INSUFFICIENT_PERMISSIONS', message: 'Insufficient permissions' }), 'product').message,
    ).toBe('Tu rol no permite cambiar el empaque.')
    expect(packagingErrorMessages(new Error('Network Error'), 'product').message).toBe(
      'No se pudo guardar el empaque. Intenta de nuevo.',
    )
  })
})
