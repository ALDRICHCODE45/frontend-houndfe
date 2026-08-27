import { describe, expect, it } from 'vitest'
import {
  GENERIC_PERMISSION_DESCRIPTION,
  HIDDEN_SUBJECTS,
  getPermissionDescription,
  getPermissionDescriptionOrFallback,
  getPermissionLabel,
  getSubjectLabel,
  isSubjectHidden,
} from '../permissions'

describe('permissions i18n', () => {
  describe('HIDDEN_SUBJECTS', () => {
    it('includes "all" (super-admin wildcard, not meant for role composition)', () => {
      expect(HIDDEN_SUBJECTS).toContain('all')
    })

    it('includes "Order" (deprecated per backend RBAC audit)', () => {
      expect(HIDDEN_SUBJECTS).toContain('Order')
    })

    it('does not hide Tenant (valid permission to assign with care)', () => {
      expect(HIDDEN_SUBJECTS).not.toContain('Tenant')
    })

    it('does not hide TenantMembership', () => {
      expect(HIDDEN_SUBJECTS).not.toContain('TenantMembership')
    })
  })

  describe('isSubjectHidden', () => {
    it('returns true for hidden subjects (case-sensitive match to backend)', () => {
      expect(isSubjectHidden('all')).toBe(true)
      expect(isSubjectHidden('Order')).toBe(true)
    })

    it('returns false for visible subjects', () => {
      expect(isSubjectHidden('Tenant')).toBe(false)
      expect(isSubjectHidden('TenantMembership')).toBe(false)
      expect(isSubjectHidden('User')).toBe(false)
      expect(isSubjectHidden('Sale')).toBe(false)
    })
  })

  describe('getSubjectLabel', () => {
    it('returns the human label for a known subject', () => {
      expect(getSubjectLabel('TenantMembership')).toBe('Miembros de la sucursal')
      expect(getSubjectLabel('User')).toBe('Usuarios')
      expect(getSubjectLabel('Tenant')).toBe('Sucursales')
      expect(getSubjectLabel('Brand')).toBe('Marcas')
      expect(getSubjectLabel('Category')).toBe('Categorías')
      expect(getSubjectLabel('Product')).toBe('Productos')
      expect(getSubjectLabel('Sale')).toBe('Ventas')
      expect(getSubjectLabel('SaleComment')).toBe('Comentarios de ventas')
      expect(getSubjectLabel('Customer')).toBe('Clientes')
      expect(getSubjectLabel('Promotion')).toBe('Promociones')
      expect(getSubjectLabel('File')).toBe('Archivos')
      expect(getSubjectLabel('GlobalPriceList')).toBe('Listas de precios globales')
      expect(getSubjectLabel('Role')).toBe('Roles')
      expect(getSubjectLabel('Employee')).toBe('Colaboradores')
      expect(getSubjectLabel('EmployeeDocument')).toBe('Documentos de colaboradores')
      expect(getSubjectLabel('EmployeeEmergencyContact')).toBe('Contactos de emergencia')
      expect(getSubjectLabel('EmployeeSalary')).toBe('Compensaciones')
      expect(getSubjectLabel('EmployeeTimeOff')).toBe('Ausencias')
      expect(getSubjectLabel('EmployeeTimeOffMedical')).toBe('Incapacidades médicas')
    })

    it('falls back to the raw subject string for unknown subjects', () => {
      expect(getSubjectLabel('UnknownThing')).toBe('UnknownThing')
    })
  })

  describe('getPermissionLabel', () => {
    it('returns the human label for known (subject, action) pairs', () => {
      expect(getPermissionLabel('TenantMembership', 'create')).toBe('Agregar miembros a la sucursal')
      expect(getPermissionLabel('TenantMembership', 'read')).toBe('Ver miembros de la sucursal')
      expect(getPermissionLabel('TenantMembership', 'update')).toBe('Cambiar rol de miembros')
      expect(getPermissionLabel('TenantMembership', 'delete')).toBe('Quitar miembros de la sucursal')

      expect(getPermissionLabel('User', 'create')).toBe('Crear usuarios nuevos')
      expect(getPermissionLabel('User', 'read')).toBe('Ver listado de usuarios')
      expect(getPermissionLabel('User', 'update')).toBe('Editar usuarios')
      expect(getPermissionLabel('User', 'delete')).toBe('Desactivar usuarios')
    })

    it('falls back to a sensible default for unknown (subject, action) pairs', () => {
      const result = getPermissionLabel('UnknownSubject', 'create')
      // Just verify it returns SOMETHING readable — not undefined or empty
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('handles the "manage" action distinctly from CRUD', () => {
      // manage:Subject is a wildcard that implies create+read+update+delete
      // It should have a label that conveys "full control"
      const result = getPermissionLabel('Brand', 'manage')
      expect(result.toLowerCase()).toMatch(/gestión|completo|total|todo/)
    })
  })

  describe('getPermissionDescription', () => {
    it('returns a 1-liner description for known (subject, action) pairs', () => {
      const desc = getPermissionDescription('TenantMembership', 'create')
      expect(desc).toBeTruthy()
      expect(typeof desc).toBe('string')
      expect(desc.length).toBeGreaterThan(20)
    })

    it('returns empty string for unknown pairs (caller can hide)', () => {
      expect(getPermissionDescription('UnknownSubject', 'whatever')).toBe('')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Regression: "permission descriptions showing in English" (i18n coverage gaps)
//
// GET /admin/permissions ships EVERY seeded (subject, action) pair with an
// ENGLISH `description`. The role slideover renders them verbatim, so any
// (subject, action) missing from the neutral-Spanish registry used to fall back
// to that backend English. These suites lock in the closed gaps + the hardened,
// never-English description resolver.
// ─────────────────────────────────────────────────────────────────────────────

describe('permissions i18n — closed coverage gaps (neutral Spanish)', () => {
  describe('NotificationConfig (primary reported gap; backend actions: read, update)', () => {
    it('maps the subject to a neutral-Spanish group label, not the raw identifier', () => {
      expect(getSubjectLabel('NotificationConfig')).toBe('Configuración de notificaciones')
      expect(getSubjectLabel('NotificationConfig')).not.toBe('NotificationConfig')
    })

    it('maps read + update to Spanish labels (never "Ver: NotificationConfig")', () => {
      expect(getPermissionLabel('NotificationConfig', 'read')).toBe(
        'Ver configuración de notificaciones',
      )
      expect(getPermissionLabel('NotificationConfig', 'update')).toBe(
        'Editar configuración de notificaciones',
      )
      expect(getPermissionLabel('NotificationConfig', 'read')).not.toContain('NotificationConfig')
      expect(getPermissionLabel('NotificationConfig', 'update')).not.toContain('NotificationConfig')
    })

    it('maps read + update to non-empty Spanish descriptions', () => {
      expect(getPermissionDescription('NotificationConfig', 'read').length).toBeGreaterThan(20)
      expect(getPermissionDescription('NotificationConfig', 'update').length).toBeGreaterThan(20)
    })
  })

  describe('SatKey (backend read-only SAT catalog subject; backend actions: read)', () => {
    it('maps the subject to a neutral-Spanish group label', () => {
      expect(getSubjectLabel('SatKey')).toBe('Claves del SAT')
      expect(getSubjectLabel('SatKey')).not.toBe('SatKey')
    })

    it('maps read to a Spanish label + description', () => {
      expect(getPermissionLabel('SatKey', 'read')).toBe('Ver claves del SAT')
      expect(getPermissionLabel('SatKey', 'read')).not.toContain('SatKey')
      expect(getPermissionDescription('SatKey', 'read').length).toBeGreaterThan(20)
    })
  })

  describe('ReceiptEvidence (backend receipt-review subject; backend actions: read, update, manage)', () => {
    it('maps the subject to a neutral-Spanish group label', () => {
      expect(getSubjectLabel('ReceiptEvidence')).toBe('Comprobantes de pago')
      expect(getSubjectLabel('ReceiptEvidence')).not.toBe('ReceiptEvidence')
    })

    it('maps read + update + manage to Spanish labels + descriptions', () => {
      for (const action of ['read', 'update', 'manage'] as const) {
        expect(getPermissionLabel('ReceiptEvidence', action)).not.toContain('ReceiptEvidence')
        expect(getPermissionDescription('ReceiptEvidence', action).length).toBeGreaterThan(20)
      }
    })

    it('describes manage as full control', () => {
      expect(getPermissionLabel('ReceiptEvidence', 'manage').toLowerCase()).toMatch(
        /gestión|completa|total|todo/,
      )
    })
  })
})

describe('getPermissionDescriptionOrFallback — hardened resolver, no English ever leaks', () => {
  it('returns the mapped neutral-Spanish description for a known pair', () => {
    const mapped = getPermissionDescription('NotificationConfig', 'read')
    expect(getPermissionDescriptionOrFallback('NotificationConfig', 'read')).toBe(mapped)
    expect(getPermissionDescriptionOrFallback('NotificationConfig', 'read')).not.toBe(
      GENERIC_PERMISSION_DESCRIPTION,
    )
  })

  it('falls back to a neutral-Spanish generic (NOT backend English) for an unmapped pair', () => {
    // The strict getter returns '' — the OLD template then rendered the
    // backend English `description`. The hardened resolver must instead return
    // curated Spanish so no English ever reaches the UI.
    expect(getPermissionDescription('UnknownSubject', 'read')).toBe('')

    const shown = getPermissionDescriptionOrFallback('UnknownSubject', 'read')
    expect(shown).toBe(GENERIC_PERMISSION_DESCRIPTION)
    expect(shown.length).toBeGreaterThan(0)
    // Representative backend English strings must never be what we render.
    expect(shown).not.toBe('View SAT catalog keys')
    expect(shown).not.toBe('Confirm or reject receipt evidence')
    expect(shown).not.toBe('View per-tenant notification configuration')
  })

  it('never returns an empty string (always shows Spanish copy)', () => {
    expect(getPermissionDescriptionOrFallback('AnythingWeird', 'frobnicate').length).toBeGreaterThan(
      0,
    )
  })
})

// Mirror of the backend PERMISSION_REGISTRY
// (houndfe-backend/src/auth/authorization/domain/permission.ts) — every
// (subject, action) that GET /admin/permissions can emit. The role slideover
// renders these verbatim, so each VISIBLE pair MUST resolve to curated
// neutral-Spanish copy or English leaks into the UI (the reported bug).
const BACKEND_PERMISSION_REGISTRY: Record<string, readonly string[]> = {
  all: ['manage'],
  Product: ['create', 'read', 'update', 'delete', 'manage'],
  Order: ['create', 'read', 'update', 'delete', 'manage'],
  User: ['create', 'read', 'update', 'delete', 'manage'],
  Role: ['create', 'read', 'update', 'delete', 'manage'],
  Tenant: ['create', 'read', 'update', 'delete'],
  Promotion: ['create', 'read', 'update', 'delete', 'manage'],
  Customer: ['create', 'read', 'update', 'delete', 'manage'],
  Sale: ['create', 'read', 'update', 'delete', 'manage'],
  SatKey: ['read'],
  ReceiptEvidence: ['read', 'update', 'manage'],
  SaleComment: ['create', 'read', 'update', 'delete', 'manage'],
  Brand: ['create', 'read', 'update', 'delete', 'manage'],
  Category: ['create', 'read', 'update', 'delete', 'manage'],
  GlobalPriceList: ['create', 'read', 'update', 'delete', 'manage'],
  TenantMembership: ['create', 'read', 'update', 'delete', 'manage'],
  File: ['create', 'read', 'delete', 'manage'],
  Employee: ['create', 'read', 'update', 'delete', 'manage'],
  EmployeeDocument: ['create', 'read', 'delete', 'manage'],
  EmployeeSalary: ['create', 'read', 'manage'],
  EmployeeTimeOff: ['create', 'read', 'update', 'delete', 'manage'],
  EmployeeTimeOffMedical: ['read'],
  EmployeeEmergencyContact: ['create', 'read', 'update', 'delete', 'manage'],
  NotificationConfig: ['read', 'update'],
}

describe('backend registry coverage — no English leaks in the role UI', () => {
  const visibleSubjects = Object.keys(BACKEND_PERMISSION_REGISTRY).filter(
    (subject) => !isSubjectHidden(subject),
  )

  it.each(visibleSubjects)('maps subject "%s" to a neutral-Spanish group label', (subject) => {
    const label = getSubjectLabel(subject)
    expect(label).not.toBe(subject) // never the raw English identifier
    expect(label.length).toBeGreaterThan(0)
  })

  it('resolves every visible (subject, action) to non-empty Spanish copy (no English fallback)', () => {
    const gaps: string[] = []
    for (const subject of visibleSubjects) {
      for (const action of BACKEND_PERMISSION_REGISTRY[subject]!) {
        if (!getPermissionDescription(subject, action)) gaps.push(`${action}:${subject}`)
        if (getPermissionLabel(subject, action).includes(subject)) gaps.push(`label ${action}:${subject}`)
      }
    }
    expect(gaps).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// sdd payment-details-admin S1 — REQ-AUTH-003 + REQ-PD-007
//
// Sub-registro de PaymentDetail en SUBJECT_LABELS + PERMISSION_COPY.
// El subject debe aparecer con la etiqueta "Datos bancarios" y EXACTAMENTE las
// cuatro acciones create/read/update/delete (sin manage, sin batch_delete).
// HIDDEN_SUBJECTS queda intacto para que el subject sea visible.
// ─────────────────────────────────────────────────────────────────────────────

describe('permissions i18n — PaymentDetail subject (sdd payment-details-admin S1, REQ-AUTH-003)', () => {
  it('exposes PaymentDetail with the canonical "Datos bancarios" label', () => {
    expect(getSubjectLabel('PaymentDetail')).toBe('Datos bancarios')
    expect(getSubjectLabel('PaymentDetail')).not.toBe('PaymentDetail')
  })

  it('does NOT hide PaymentDetail (HIDDEN_SUBJECTS untouched)', () => {
    expect(isSubjectHidden('PaymentDetail')).toBe(false)
  })

  it('exposes exactly the four CRUD actions for PaymentDetail (no manage, no batch_delete)', () => {
    // The four standard actions must resolve to curated Spanish labels — they
    // do NOT fall through to the "{actionLabel}: {subjectLabel}" default
    // (which would yield "Crear: Datos bancarios", not the curated copy).
    for (const action of ['create', 'read', 'update', 'delete'] as const) {
      const label = getPermissionLabel('PaymentDetail', action)
      const fallback = `${getPermissionLabel('Other', action).split(':')[0]?.trim()}: Datos bancarios`
      expect(label).not.toBe(fallback)
    }

    // 'manage' and 'batch_delete' MUST fall back to the generic concatenation
    // — proving the curated copy does NOT contain those action keys. This is
    // the cheapest way to assert "no manage, no batch_delete" using the
    // public API only.
    const manageLabel = getPermissionLabel('PaymentDetail', 'manage')
    expect(manageLabel).toContain('Datos bancarios')
    expect(manageLabel.startsWith('Gestión')).toBe(true) // generic prefix from ACTION_FALLBACK_LABELS
    const batchDeleteLabel = getPermissionLabel('PaymentDetail', 'batch_delete')
    expect(batchDeleteLabel.startsWith('batch_delete:')).toBe(true)
  })

  it('resolves each PaymentDetail CRUD action to a neutral-Spanish label without leaking the raw subject', () => {
    for (const action of ['create', 'read', 'update', 'delete'] as const) {
      const label = getPermissionLabel('PaymentDetail', action)
      expect(label).toBeTruthy()
      expect(label).not.toBe('')
      expect(label).not.toContain('PaymentDetail')
    }
  })

      it('returns a non-empty Spanish description for every PaymentDetail CRUD action', () => {
        for (const action of ['create', 'read', 'update', 'delete'] as const) {
          const desc = getPermissionDescription('PaymentDetail', action)
          expect(desc.length).toBeGreaterThan(20)
        }
      })
    })

// ──────────────────────────────────────────────────────────────────────────
// sdd delivery-routes S1a — REQ-AUTH-DR-002 + REQ-AUTH-DR-004
//
// Sub-registro de DeliveryRoute en SUBJECT_LABELS + PERMISSION_COPY.
// El subject debe aparecer con la etiqueta "Rutas de entrega" y EXACTAMENTE
// las cuatro acciones create/read/update/delete (sin manage, sin
// batch_delete — backend registry expone solo CRUD).
// HIDDEN_SUBJECTS queda intacto para que el subject sea visible.
// ──────────────────────────────────────────────────────────────────────────

describe('permissions i18n — DeliveryRoute subject (sdd delivery-routes S1a, REQ-AUTH-DR-002)', () => {
it('exposes DeliveryRoute with the canonical "Rutas de entrega" label', () => {
  expect(getSubjectLabel('DeliveryRoute')).toBe('Rutas de entrega')
  expect(getSubjectLabel('DeliveryRoute')).not.toBe('DeliveryRoute')
})

it('does NOT hide DeliveryRoute (HIDDEN_SUBJECTS untouched, REQ-AUTH-DR-004)', () => {
  // The role-permissions UI MUST render DeliveryRoute — otherwise the
  // manager cannot assign the subject and the manager-only list view
  // would never open. Asserting the negative here freezes the
  // not-hidden invariant.
  expect(isSubjectHidden('DeliveryRoute')).toBe(false)
  expect(HIDDEN_SUBJECTS).not.toContain('DeliveryRoute')
})

it('exposes exactly the four CRUD actions for DeliveryRoute (no manage, no batch_delete)', () => {
  // The four standard actions must resolve to curated Spanish labels —
  // they do NOT fall through to the "{actionLabel}: {subjectLabel}"
  // default (which would yield "Crear: Rutas de entrega", not the
  // curated copy).
  for (const action of ['create', 'read', 'update', 'delete'] as const) {
    const label = getPermissionLabel('DeliveryRoute', action)
    const fallback = `${getPermissionLabel('Other', action).split(':')[0]?.trim()}: Rutas de entrega`
    expect(label).not.toBe(fallback)
  }

  // 'manage' and 'batch_delete' MUST fall back to the generic
  // concatenation — proving the curated copy does NOT contain those
  // action keys. This is the cheapest way to assert "no manage, no
  // batch_delete" using the public API only.
  const manageLabel = getPermissionLabel('DeliveryRoute', 'manage')
  expect(manageLabel).toContain('Rutas de entrega')
  expect(manageLabel.startsWith('Gestión')).toBe(true) // generic prefix from ACTION_FALLBACK_LABELS
  const batchDeleteLabel = getPermissionLabel('DeliveryRoute', 'batch_delete')
  expect(batchDeleteLabel.startsWith('batch_delete:')).toBe(true)
})

it('resolves each DeliveryRoute CRUD action to a neutral-Spanish label without leaking the raw subject', () => {
  for (const action of ['create', 'read', 'update', 'delete'] as const) {
    const label = getPermissionLabel('DeliveryRoute', action)
    expect(label).toBeTruthy()
    expect(label).not.toBe('')
    expect(label).not.toContain('DeliveryRoute')
  }
})

it('returns a non-empty Spanish description for every DeliveryRoute CRUD action', () => {
  for (const action of ['create', 'read', 'update', 'delete'] as const) {
    const desc = getPermissionDescription('DeliveryRoute', action)
    expect(desc.length).toBeGreaterThan(20)
  }
})

it('keeps DeliveryRoute alongside PaymentDetail/PaymentMethod without disturbing their copy', () => {
  // Lock-step invariant: adding a new subject MUST NOT break the
  // existing ones. A regression in SUBJECT_LABELS / PERMISSION_COPY
  // shape would surface as PaymentDetail/PaymentMethod labels suddenly
  // returning empty strings.
  for (const action of ['create', 'read', 'update', 'delete'] as const) {
    expect(getPermissionDescription('PaymentDetail', action).length).toBeGreaterThan(20)
    expect(getPermissionDescription('PaymentMethod', action).length).toBeGreaterThan(20)
  }
})
})
