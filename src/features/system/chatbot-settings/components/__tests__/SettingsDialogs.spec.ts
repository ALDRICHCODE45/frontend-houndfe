// ApplyToAllDialog (branch list, partial result, conflict/error steps) and ConflictDialog.
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ApplyToAllDialog from '../ApplyToAllDialog.vue'
import ConflictDialog from '../ConflictDialog.vue'
import type { ChatbotApplyResult } from '../../interfaces/chatbot-settings.types'
import { clone, settingsFixture } from '../../interfaces/__tests__/chatbot-settings.fixture'

// UModal pulls Nuxt runtime composables that jsdom does not wire; this stub renders the slots when open.
vi.mock('@nuxt/ui/runtime/components/Modal.vue', () => ({
  default: {
    name: 'UModal',
    props: ['open', 'title', 'dismissible', 'close', 'ui'],
    emits: ['update:open'],
    template:
      '<div v-if="open" data-testid="u-modal"><h2 data-testid="modal-title">{{ title }}</h2><slot name="body" /><slot name="footer" /></div>',
  },
}))

const dry: ChatbotApplyResult = {
  dryRun: true,
  source: { tenantId: 't1', version: 3 },
  tenantsApplied: [
    { tenantId: 't2', name: 'Sucursal Norte' },
    { tenantId: 't3', name: 'Sucursal Poniente' },
  ],
  tenantsUnchanged: [
    { tenantId: 't1', name: 'Sucursal Centro' },
    { tenantId: 't4', name: 'Sucursal Aeropuerto' },
  ],
  tenantsSkipped: [
    { tenantId: 't5', name: 'Sucursal Sur', reason: 'NO_PERMISSION' },
    { tenantId: 't6', name: 'Sucursal Bodega', reason: 'TENANT_INACTIVE' },
  ],
  tenantsFailed: [],
}

function mountApply(props: Record<string, unknown> = {}) {
  return mount(ApplyToAllDialog, {
    props: { step: 'review', result: dry, errorKind: null, dirtyCount: 0, creating: false, version: 3, ...props },
  })
}
const title = (w: ReturnType<typeof mountApply>) => w.get('[data-testid="modal-title"]').text()

describe('ApplyToAllDialog', () => {
  it('is closed with step «closed»', () => {
    expect(mountApply({ step: 'closed', result: null }).find('[data-testid="u-modal"]').exists()).toBe(false)
  })

  it('review: lists who changes, who is unchanged (source marked) and who is skipped with the reason', () => {
    const w = mountApply()
    expect(title(w)).toBe('Aplicar a 2 sucursales')
    expect(w.get('[data-testid="branches-applied"]').text()).toContain('Sucursal Norte')
    expect(w.get('[data-testid="branches-applied"]').text()).toContain('Sucursal Poniente')
    expect(w.get('[data-testid="branches-unchanged"]').text()).toContain('Esta sucursal (origen)')
    const skipped = w.get('[data-testid="branches-skipped"]').text()
    expect(skipped).toContain('No tienes permiso para aplicar ahí')
    expect(skipped).toContain('Sucursal desactivada')
    expect(w.text()).toContain('Solo se incluyen las sucursales donde tienes membresía')
    expect(w.text()).toContain('Plantilla y su texto de costo')
  })

  it('review: Aplicar confirms and Cancelar closes', async () => {
    const w = mountApply()
    expect(w.get('[data-testid="apply-confirm"]').text()).toBe('Aplicar a 2 sucursales')
    await w.get('[data-testid="apply-confirm"]').trigger('click')
    await w.get('[data-testid="apply-cancel"]').trigger('click')
    expect(w.emitted('confirm')).toHaveLength(1)
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('review with nothing to change says so and has no confirm', () => {
    const w = mountApply({ result: { ...dry, tenantsApplied: [], tenantsSkipped: [] } })
    expect(title(w)).toBe('Nada que aplicar')
    expect(w.find('[data-testid="apply-confirm"]').exists()).toBe(false)
    expect(w.text()).toContain('ya tienen esta configuración')
  })

  it('save first: asks to save, says how many changes, and emits save-first', async () => {
    const w = mountApply({ step: 'save-first', result: null, dirtyCount: 2 })
    expect(title(w)).toBe('Guardar y revisar')
    expect(w.text()).toContain('2 cambios sin guardar')
    await w.get('[data-testid="apply-save-first"]').trigger('click')
    expect(w.emitted('save-first')).toHaveLength(1)
    expect(mountApply({ step: 'save-first', result: null, dirtyCount: 0, creating: true }).text()).toContain(
      'aún no tiene configuración guardada',
    )
  })

  it('blocked: says someone with edit permission must save the settings first, and only offers Cerrar', async () => {
    const w = mountApply({ step: 'blocked', result: null, creating: true })
    expect(title(w)).toBe('Primero hay que guardar la configuración')
    const text = w.get('[data-testid="apply-blocked"]').text()
    expect(text).toContain('aún no tiene configuración guardada')
    expect(text).toContain('alguien con permiso para editar')
    expect(w.find('[data-testid="apply-save-first"]').exists()).toBe(false)
    expect(w.find('[data-testid="apply-confirm"]').exists()).toBe(false)
    await w.get('[data-testid="apply-close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('result: per-branch outcome with the FAILED recompute warning', () => {
    const w = mountApply({
      step: 'result',
      result: {
        ...dry,
        dryRun: false,
        tenantsApplied: [
          { tenantId: 't2', name: 'Sucursal Norte', recompute: 'DONE' },
          { tenantId: 't3', name: 'Sucursal Poniente', recompute: 'FAILED' },
        ],
      },
    })
    expect(title(w)).toBe('Configuración aplicada')
    const applied = w.get('[data-testid="branches-applied"]').text()
    expect(applied).toContain('Aplicada')
    expect(applied).toContain('Guardada; los plazos de sus solicitudes abiertas se actualizarán más tarde')
    expect(w.get('[data-testid="apply-result-summary"]').text()).toContain('Revisa los avisos')
    expect(w.find('[data-testid="apply-retry-failed"]').exists()).toBe(false)
  })

  it('partial result: shows the branches that failed and offers «Reintentar las que fallaron»', async () => {
    const w = mountApply({
      step: 'result',
      result: {
        ...dry,
        dryRun: false,
        tenantsApplied: [{ tenantId: 't2', name: 'Sucursal Norte', recompute: 'DONE' }],
        tenantsFailed: [{ tenantId: 't3', name: 'Sucursal Poniente' }],
      },
    })
    expect(title(w)).toBe('Se aplicó en algunas sucursales')
    expect(w.get('[data-testid="branches-failed"]').text()).toContain('Sucursal Poniente')
    expect(w.get('[data-testid="apply-result-summary"]').text()).toContain('1 sucursal recibió los cambios y 1 falló')
    await w.get('[data-testid="apply-retry-failed"]').trigger('click')
    expect(w.emitted('confirm')).toHaveLength(1)
    await w.get('[data-testid="apply-done"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('loading and applying block the dialog (no confirm, no close)', () => {
    expect(title(mountApply({ step: 'loading', result: null }))).toBe('Revisando sucursales')
    const applying = mountApply({ step: 'applying' })
    expect(title(applying)).toBe('Aplicando…')
    expect(applying.find('[data-testid="apply-confirm"]').exists()).toBe(false)
  })

  it('conflict (with or without current) and errors offer retry with their own copy', async () => {
    const conflict = mountApply({ step: 'conflict', result: null, errorKind: 'conflict' })
    expect(title(conflict)).toBe('La configuración cambió')
    expect(conflict.get('[data-testid="apply-retry"]').text()).toBe('Volver a revisar')
    await conflict.get('[data-testid="apply-retry"]').trigger('click')
    expect(conflict.emitted('retry')).toHaveLength(1)

    const forbidden = mountApply({ step: 'error', result: null, errorKind: 'forbidden' })
    expect(forbidden.get('[data-testid="apply-error"]').text()).toContain('Ya no tienes permiso')
    const network = mountApply({ step: 'error', result: null, errorKind: 'network' })
    expect(network.get('[data-testid="apply-error"]').text()).toContain('No se pudo conectar')
    expect(network.get('[data-testid="apply-retry"]').text()).toBe('Reintentar')
  })
})

describe('ConflictDialog', () => {
  function versions() {
    const base = settingsFixture()
    const mine = clone(base)
    mine.windowWarningMinutes = 60
    mine.slas.find((s) => s.subtype === 'COMPLAINT')!.claimMinutes = 45
    const theirs = settingsFixture({ version: 4 })
    theirs.slas.find((s) => s.subtype === 'COMPLAINT')!.claimMinutes = 20
    theirs.closedDates = [...theirs.closedDates, '2027-01-06']
    return { base, mine, theirs }
  }
  const mountConflict = (props: Record<string, unknown> = {}) =>
    mount(ConflictDialog, { props: { open: true, ...versions(), ...props } })

  it('is closed without the other version or when not open', () => {
    expect(mountConflict({ theirs: null }).find('[data-testid="u-modal"]').exists()).toBe(false)
    expect(mountConflict({ open: false }).find('[data-testid="u-modal"]').exists()).toBe(false)
  })

  it('names the versions and splits only mine / only theirs / both', () => {
    const w = mountConflict()
    expect(w.get('[data-testid="conflict-dialog"]').text()).toContain('versión 4')
    expect(w.get('[data-testid="conflict-dialog"]').text()).toContain('partía de la 3')
    expect(w.get('[data-testid="conflict-only-mine"]').text()).toContain('Aviso de ventana')
    expect(w.get('[data-testid="conflict-only-theirs"]').text()).toContain('Fechas cerradas')
    const both = w.get('[data-testid="conflict-both"]').text()
    expect(both).toContain('tú: atender 45 min')
    expect(both).toContain('otra persona: atender 20 min')
    expect(w.text()).toContain('tus valores reemplazan los de la otra persona')
  })

  it('keeps mine or uses theirs, and closes', async () => {
    const w = mountConflict()
    expect(w.get('[data-testid="conflict-use-theirs"]').text()).toBe('Usar la versión 4 y descartar lo mío')
    await w.get('[data-testid="conflict-keep-mine"]').trigger('click')
    await w.get('[data-testid="conflict-use-theirs"]').trigger('click')
    expect(w.emitted('keep-mine')).toHaveLength(1)
    expect(w.emitted('use-theirs')).toHaveLength(1)
  })
})
