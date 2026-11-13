import { describe, expect, it } from 'vitest'
import { makeDetail } from '../detail-fixture'
import type { ChatbotRequestDetail, ChatbotLiveSessionState } from '../../interfaces/chatbot-request.types'
import { composerMode, elapsedLabel, isAttendee, sessionBadge, silentMinutes } from '../live-session'

const live = (
  state: ChatbotLiveSessionState,
  overrides: Partial<ChatbotRequestDetail> = {},
): ChatbotRequestDetail =>
  makeDetail({
    status: state === 'WAITING' ? 'NEW' : 'IN_PROGRESS',
    assignee: state === 'WAITING' ? null : { id: 'u-1', displayName: 'Laura Méndez' },
    allowedActions: state === 'ACTIVE' ? ['SEND_MESSAGE', 'FINISH'] : [],
    liveSession: {
      state,
      handoffEpoch: 3,
      lastStaffActivityAt: '2026-11-13T15:58:00.000Z',
      lastCustomerMessageAt: '2026-11-13T16:01:40.000Z',
    },
    ...overrides,
  })

describe('sessionBadge — the five session states (handoff 20 §1)', () => {
  it.each([
    ['STARTING', 'Conectando…'],
    ['ACTIVE', 'En vivo'],
    ['ENDING', 'Terminando…'],
    ['ENDED', 'Terminada'],
    ['WAITING', 'Sin confirmar'],
  ] as const)('%s reads «%s»', (state, label) => {
    expect(sessionBadge(state).label).toBe(label)
  })

  it('only «Conectando…» and «Terminando…» are in progress', () => {
    expect(sessionBadge('STARTING').busy).toBe(true)
    expect(sessionBadge('ENDING').busy).toBe(true)
    expect(sessionBadge('ACTIVE').busy).toBe(false)
  })
})

describe('elapsedLabel — «Conectando…» shows elapsed time only', () => {
  const since = '2026-11-13T16:00:00.000Z'
  it('writes m:ss from the claim', () => {
    expect(elapsedLabel(since, new Date('2026-11-13T16:00:42.000Z'))).toBe('0:42')
    expect(elapsedLabel(since, new Date('2026-11-13T16:02:05.000Z'))).toBe('2:05')
  })
  it('never goes negative (a client clock behind the server) and tolerates no date', () => {
    expect(elapsedLabel(since, new Date('2026-11-13T15:59:00.000Z'))).toBe('0:00')
    expect(elapsedLabel(null, new Date())).toBeNull()
    expect(elapsedLabel('nope', new Date())).toBeNull()
  })
})

describe('silentMinutes', () => {
  it('counts whole minutes since the last customer message', () => {
    const detail = live('ACTIVE')
    expect(silentMinutes(detail.liveSession, new Date('2026-11-13T16:39:41.000Z'))).toBe(38)
    expect(silentMinutes(null, new Date())).toBeNull()
  })
})

describe('isAttendee', () => {
  it('is the assignee of an open (IN_PROGRESS) request', () => {
    expect(isAttendee(live('ACTIVE'), 'u-1')).toBe(true)
    expect(isAttendee(live('ACTIVE'), 'u-2')).toBe(false)
    expect(isAttendee(live('ACTIVE'), null)).toBe(false)
    expect(isAttendee(live('ACTIVE', { status: 'RESOLVED' }), 'u-1')).toBe(false)
    expect(isAttendee(live('WAITING'), 'u-1')).toBe(false)
  })
})

describe('composerMode', () => {
  it('shows the composer for the attendee of an ACTIVE session with SEND_MESSAGE', () => {
    expect(composerMode({ detail: live('ACTIVE'), currentUserId: 'u-1', windowClosed: false })).toBe('composer')
  })

  it('blocks it when the window is closed', () => {
    expect(composerMode({ detail: live('ACTIVE'), currentUserId: 'u-1', windowClosed: true })).toBe('blocked')
  })

  it('waits («Conectando…») while STARTING', () => {
    expect(composerMode({ detail: live('STARTING'), currentUserId: 'u-1', windowClosed: false })).toBe('connecting')
  })

  it('is read-only for someone who is not the attendee, and for an attendee without SEND_MESSAGE', () => {
    expect(composerMode({ detail: live('ACTIVE'), currentUserId: 'u-2', windowClosed: false })).toBe('readonly')
    expect(
      composerMode({ detail: live('ACTIVE', { allowedActions: ['FINISH'] }), currentUserId: 'u-1', windowClosed: false }),
    ).toBe('readonly')
  })

  it('says the conversation ended for ENDING and ENDED, and waits for a claim on WAITING', () => {
    expect(composerMode({ detail: live('ENDING'), currentUserId: 'u-1', windowClosed: false })).toBe('ended')
    expect(composerMode({ detail: live('ENDED'), currentUserId: 'u-1', windowClosed: false })).toBe('ended')
    expect(composerMode({ detail: live('WAITING'), currentUserId: 'u-1', windowClosed: false })).toBe('waiting')
  })

  it('is none for a request with no live session', () => {
    expect(composerMode({ detail: makeDetail(), currentUserId: 'u-1', windowClosed: false })).toBe('none')
  })
})
