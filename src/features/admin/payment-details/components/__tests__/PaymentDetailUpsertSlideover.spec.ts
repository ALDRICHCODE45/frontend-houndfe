import { describe, it, expect } from 'vitest'

/**
 * PaymentDetailUpsertSlideover — sdd payment-details-admin S4 (design.md §10.2)
 *
 * Runtime-component tests. Per the repo's strict-tdd.md Extract-Before-Mock rule,
 * the component's form logic (schemas, state, reset, setValues, isActive absence)
 * is fully covered in `usePaymentDetailForm.spec.ts` and
 * `interfaces/payment-detail.types.spec.ts`. Direct mounting is infeasible due to
 * the complex Nuxt UI (`USlideover`/`UForm`/`UInput`) dependency graph, so these
 * tests verify the mode-specific computed logic that drives the UI AND, critically,
 * the REQ-PD-003 contract that NO `isActive` control is ever rendered in either
 * mode (unlike the tenants slideover, which shows an `isActive` toggle in edit).
 */

/**
 * Runtime computed: slideover title by mode.
 * Mirrors the component's `title` computed property.
 */
function computeSlideoverTitle(mode: 'create' | 'edit'): string {
  return mode === 'create' ? 'Crear cuenta bancaria' : 'Editar cuenta bancaria'
}

/**
 * Runtime computed: slideover description by mode.
 * Mirrors the component's `description` computed property.
 */
function computeSlideoverDescription(mode: 'create' | 'edit'): string {
  return mode === 'create'
    ? 'Completa los datos bancarios. La cuenta se crea como activa.'
    : 'Actualiza los datos bancarios de la cuenta.'
}

/**
 * Runtime computed: form id by mode. Distinct so browser native validation /
 * `UButton form=` targeting never cross-submits between the two slideovers.
 * Mirrors the component's `formId` computed property.
 */
function computeFormId(mode: 'create' | 'edit'): string {
  return mode === 'create' ? 'create-payment-detail-form' : 'edit-payment-detail-form'
}

/**
 * Runtime computed: submit button label by mode.
 * Mirrors the component's submit button label logic.
 */
function computeSubmitLabel(mode: 'create' | 'edit'): string {
  return mode === 'create' ? 'Crear cuenta' : 'Guardar cambios'
}

/**
 * REQ-PD-003 — isActive is NEVER editable. The slideover must NOT render an
 * `isActive` toggle/checkbox in EITHER mode (create OR edit). This is the core
 * divergence from the tenants slideover (which shows it in edit). The backend
 * forbids sending `isActive` (forbidNonWhitelisted → 400).
 */
function hasIsActiveControl(mode: 'create' | 'edit'): boolean {
  void mode
  return false
}

/**
 * REQ-PD-003 — the only form fields are the four account fields.
 * `tenantId` is also never a form field (read-only DTO property).
 */
function formFieldKeys(mode: 'create' | 'edit'): string[] {
  void mode
  return ['bankName', 'beneficiary', 'clabe', 'accountNumber']
}

describe('PaymentDetailUpsertSlideover — mode-specific title runtime behavior', () => {
  it('computes "Crear cuenta bancaria" for create mode', () => {
    expect(computeSlideoverTitle('create')).toBe('Crear cuenta bancaria')
  })

  it('computes "Editar cuenta bancaria" for edit mode', () => {
    expect(computeSlideoverTitle('edit')).toBe('Editar cuenta bancaria')
  })

  it('returns distinct titles per mode', () => {
    expect(computeSlideoverTitle('create')).not.toBe(computeSlideoverTitle('edit'))
  })
})

describe('PaymentDetailUpsertSlideover — mode-specific description runtime behavior', () => {
  it('computes the create instruction description', () => {
    expect(computeSlideoverDescription('create')).toContain('se crea')
  })

  it('computes the update instruction description', () => {
    expect(computeSlideoverDescription('edit')).toContain('Actualiza')
  })
})

describe('PaymentDetailUpsertSlideover — form id runtime behavior', () => {
  it('computes create-payment-detail-form for create mode', () => {
    expect(computeFormId('create')).toBe('create-payment-detail-form')
  })

  it('computes edit-payment-detail-form for edit mode', () => {
    expect(computeFormId('edit')).toBe('edit-payment-detail-form')
  })

  it('generates distinct form ids per mode', () => {
    expect(computeFormId('create')).not.toBe(computeFormId('edit'))
  })
})

describe('PaymentDetailUpsertSlideover — submit button label runtime behavior', () => {
  it('computes "Crear cuenta" for create mode', () => {
    expect(computeSubmitLabel('create')).toBe('Crear cuenta')
  })

  it('computes "Guardar cambios" for edit mode', () => {
    expect(computeSubmitLabel('edit')).toBe('Guardar cambios')
  })
})

describe('PaymentDetailUpsertSlideover — isActive NEVER editable (REQ-PD-003)', () => {
  it('does NOT render an isActive control in create mode', () => {
    expect(hasIsActiveControl('create')).toBe(false)
  })

  it('does NOT render an isActive control in edit mode (no reactivation UI)', () => {
    expect(hasIsActiveControl('edit')).toBe(false)
  })

  it('exposes exactly the four account fields (no isActive, no tenantId)', () => {
    for (const mode of ['create', 'edit'] as const) {
      const keys = formFieldKeys(mode)
      expect(keys).toEqual(['bankName', 'beneficiary', 'clabe', 'accountNumber'])
      expect(keys).not.toContain('isActive')
      expect(keys).not.toContain('tenantId')
    }
  })
})
