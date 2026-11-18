// notificationFormState.spec.ts — pure helpers behind the redesigned screen
// (artboard design/notification-config/01 + 04): the save bar's change count,
// the per-row state word and pause reason, the module «Activar todas» state
// and the delivery summary under the master switch.

import { describe, expect, it } from 'vitest'
import {
  computeActionStateWord,
  computeDeliverySummary,
  computeModuleToggleState,
  computePausedReason,
  countFormChanges,
  setModuleActions,
} from '../notificationRowState'
import { ACTION_REGISTRY } from '../../registry/action-registry'
import type { NotificationConfigForm } from '../../interfaces/notification-config.types'

const promotions = ACTION_REGISTRY.find((m) => m.moduleKey === 'promotions')!

function form(partial: Partial<NotificationConfigForm> = {}): NotificationConfigForm {
  return { enabled: true, recipientUserIds: [], enabledActions: [], ...partial }
}

describe('countFormChanges', () => {
  it('is 0 for identical snapshots, regardless of order', () => {
    const a = form({ recipientUserIds: ['u1', 'u2'], enabledActions: ['LOW_STOCK', 'DELIVERY_NEXT_STOP'] })
    const b = form({ recipientUserIds: ['u2', 'u1'], enabledActions: ['DELIVERY_NEXT_STOP', 'LOW_STOCK'] })
    expect(countFormChanges(a, b)).toBe(0)
  })

  it('counts the master, each added/removed recipient and each added/removed action', () => {
    const pristine = form({ enabled: true, recipientUserIds: ['u1', 'u2'], enabledActions: ['LOW_STOCK'] })
    const current = form({ enabled: false, recipientUserIds: ['u2', 'u3'], enabledActions: ['PROMOTION_EXPIRING'] })
    // master 1 + recipients (u3 added, u1 removed) 2 + actions (added, removed) 2
    expect(countFormChanges(current, pristine)).toBe(5)
  })
})

describe('computeActionStateWord', () => {
  it('says Activado / Desactivado while the master is on', () => {
    expect(computeActionStateWord(true, true)).toBe('Activado')
    expect(computeActionStateWord(false, true)).toBe('Desactivado')
  })

  it('says En pausa for a kept selection while the master is off', () => {
    expect(computeActionStateWord(true, false)).toBe('En pausa')
    expect(computeActionStateWord(false, false)).toBe('Desactivado')
  })
})

describe('computePausedReason', () => {
  it('explains the pause for a kept selection and the lock for an unselected action', () => {
    expect(computePausedReason(true)).toBe('En pausa: las notificaciones están desactivadas.')
    expect(computePausedReason(false)).toBe(
      'No disponible mientras las notificaciones están desactivadas.',
    )
  })
})

describe('computeModuleToggleState / setModuleActions', () => {
  it('is false, mixed or true by how many of the module actions are on', () => {
    expect(computeModuleToggleState(promotions, [])).toEqual({ pressed: 'false', on: 0, total: 2 })
    expect(computeModuleToggleState(promotions, ['PROMOTION_EXPIRING'])).toEqual({
      pressed: 'mixed',
      on: 1,
      total: 2,
    })
    expect(
      computeModuleToggleState(promotions, ['PROMOTION_EXPIRING', 'PROMOTION_NEAR_CAPACITY']),
    ).toEqual({ pressed: 'true', on: 2, total: 2 })
  })

  it('turns every module action on without touching the others, keeping existing order', () => {
    expect(setModuleActions(promotions, ['LOW_STOCK', 'PROMOTION_NEAR_CAPACITY'], true)).toEqual([
      'LOW_STOCK',
      'PROMOTION_NEAR_CAPACITY',
      'PROMOTION_EXPIRING',
    ])
  })

  it('turns every module action off without touching the others', () => {
    expect(
      setModuleActions(promotions, ['PROMOTION_EXPIRING', 'LOW_STOCK', 'PROMOTION_NEAR_CAPACITY'], false),
    ).toEqual(['LOW_STOCK'])
  })
})

describe('computeDeliverySummary', () => {
  it('master off: nothing is sent and the selection is kept', () => {
    const s = computeDeliverySummary(form({ enabled: false, enabledActions: ['LOW_STOCK'] }), 0)
    expect(s.tone).toBe('off')
    expect(s.title).toBe('No se envía ningún aviso.')
    expect(s.detail).toContain('1 aviso')
  })

  it('on without actions: warns that nothing will arrive', () => {
    const s = computeDeliverySummary(form(), 2)
    expect(s.tone).toBe('warn')
    expect(s.title).toBe('Activadas, pero sin avisos elegidos.')
  })

  it('on with user actions but nobody to send to: warns', () => {
    const s = computeDeliverySummary(form({ enabledActions: ['LOW_STOCK', 'PROMOTION_EXPIRING'] }), 0)
    expect(s.tone).toBe('warn')
    expect(s.title).toBe('Falta a quién enviar.')
    expect(s.detail).toBe('2 avisos necesitan al menos un usuario.')
  })

  it('ready: says how many notices go to how many users and that Próxima parada goes to the customer', () => {
    const s = computeDeliverySummary(
      form({ enabledActions: ['LOW_STOCK', 'DELIVERY_NEXT_STOP', 'PROMOTION_EXPIRING'] }),
      3,
    )
    expect(s.tone).toBe('ok')
    expect(s.title).toBe('Se envían 3 avisos por correo a 3 usuarios')
    expect(s.detail).toBe('Próxima parada va al cliente.')
  })

  it('ready with only the customer action: no user count', () => {
    const s = computeDeliverySummary(form({ enabledActions: ['DELIVERY_NEXT_STOP'] }), 0)
    expect(s.tone).toBe('ok')
    expect(s.title).toBe('Se envía 1 aviso por correo')
  })
})
