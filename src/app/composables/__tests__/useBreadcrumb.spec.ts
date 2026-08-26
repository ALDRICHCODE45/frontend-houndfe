import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useBreadcrumb } from '../useBreadcrumb'

// Route instance mock — useBreadcrumb only reads the resolved `path`.
const routePath = ref('/')

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: routePath.value }),
}))

describe('useBreadcrumb', () => {
  beforeEach(() => {
    routePath.value = '/'
  })

  it('returns a single Dashboard item for the home route', () => {
    routePath.value = '/'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual([{ label: 'Dashboard', to: '/' }])
  })

  it('returns Módulo / Sección for a normal module route', () => {
    routePath.value = '/pos/ventas'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual([
      { label: 'POS' },
      { label: 'Ventas', to: '/pos/ventas' },
    ])
  })

  it('keeps the parent section for a detail sub-route (/:id)', () => {
    routePath.value = '/pos/ventas/123'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual([
      { label: 'POS' },
      { label: 'Ventas', to: '/pos/ventas' },
    ])
  })

  it('keeps the parent section for a create sub-route (/nueva)', () => {
    routePath.value = '/pos/cotizaciones/nueva'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual([
      { label: 'POS' },
      { label: 'Cotizaciones', to: '/pos/cotizaciones' },
    ])
  })

  it('picks the most specific match for nested admin routes', () => {
    routePath.value = '/admin/colaboradores/documentos-vencer'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual([
      { label: 'RR.HH.' },
      { label: 'Vencimientos', to: '/admin/colaboradores/documentos-vencer' },
    ])
  })

  it('resolves the admin payment-details section', () => {
    routePath.value = '/admin/payment-details'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual([
      { label: 'Admin' },
      { label: 'Datos bancarios', to: '/admin/payment-details' },
    ])
  })

  it('resolves the sistema notification config section', () => {
    routePath.value = '/sistema/configuracion/notificaciones'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual([
      { label: 'Sistema' },
      { label: 'Notificaciones', to: '/sistema/configuracion/notificaciones' },
    ])
  })

  it('falls back to Dashboard for unmatched routes', () => {
    routePath.value = '/ruta-desconocida'
    const { breadcrumb } = useBreadcrumb()
    expect(breadcrumb.value).toEqual([{ label: 'Dashboard', to: '/' }])
  })
})
