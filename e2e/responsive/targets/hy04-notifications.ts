import type { Locator, Page } from '@playwright/test'
import {
  stampEvidenceSurface,
  uniqueAnchor,
  type ResponsiveTargetAdapter,
} from './types'

type NotificationActions = { masterToggle: Locator; recipientTrigger: Locator; recipientRemove: Locator; save: Locator }
type NotificationStates = { accordion: Locator; actionRows: Locator; recipients: Locator; footer: Locator }

export const HY04_NOTIFICATIONS: ResponsiveTargetAdapter<NotificationActions, NotificationStates> = {
  surfaceId: 'HY-04', archetype: 'HY', route: '/sistema/configuracion/notificaciones', containerOwner: 'card',
  strategy: 'stacked-list', fixtureId: 'notifications-config',
  essentialFields: ['notification action', 'enabled state', 'assigned recipients', 'save action'],
  supportedStates: ['loading', 'success', 'overlay-open'], preferenceKeys: [], risks: ['R3', 'R5', 'R6', 'R7', 'R8'],
  exclusions: [
    { assertionId: 'scroll-extremes', reason: 'HY-04 is a stacked no-horizontal-scroll settings matrix', followUp: 'Keep no-scroll geometry in WU-4d' },
    { assertionId: 'sticky-pinned-alignment', reason: 'HY-04 has no table header or pinned column', followUp: 'No follow-up unless presentation changes' },
    { assertionId: 'preference-compatibility', reason: 'HY-04 stores no table/card preference', followUp: 'No follow-up unless a preference is introduced' },
    { assertionId: 'overlay-lifecycle', reason: 'Recipient overlay is excluded from the initial representative adapter', followUp: 'WU-4d overlay coverage' },
  ],
  stateDrivers: {
    loading: { scenario: 'loading', status: 'ready' }, success: { scenario: 'success', status: 'ready' },
    error: { scenario: 'error-5xx', status: 'strict-red', note: 'No distinct query-error surface is currently declared; strict conformance must preserve this RED.' },
    recipientOverlay: { scenario: 'overlay-open', status: 'excluded', note: 'Overlay lifecycle is explicitly deferred.' },
  },
  async resolve(page: Page) {
    const anchor = await uniqueAnchor(page.getByTestId('notifications-card-actions'), 'HY-04 actions card owner')
    await stampEvidenceSurface(anchor, 'HY-04')
    return {
      target: HY04_NOTIFICATIONS, anchor, mode: 'stacked', preferences: HY04_NOTIFICATIONS.preferenceKeys,
      actions: {
        masterToggle: await uniqueAnchor(page.getByTestId('master-toggle'), 'HY-04 master toggle'),
        recipientTrigger: await uniqueAnchor(page.getByTestId('recipient-select-trigger'), 'HY-04 recipient trigger'),
        recipientRemove: page.locator('[data-testid^="recipient-chip-remove-"]'),
        save: await uniqueAnchor(page.getByTestId('save-button'), 'HY-04 save action'),
      },
      states: {
        accordion: await uniqueAnchor(anchor.getByTestId('actions-accordion'), 'HY-04 actions accordion'),
        actionRows: anchor.locator('[data-testid^="action-row-"]'), recipients: await uniqueAnchor(page.getByTestId('recipient-chips'), 'HY-04 recipient chips'),
        footer: await uniqueAnchor(page.getByTestId('notifications-footer'), 'HY-04 sticky footer'),
      },
    }
  },
}
