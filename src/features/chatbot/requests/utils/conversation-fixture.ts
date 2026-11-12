/** Test-only builder for conversation messages (handoff 18 §2). Not imported by runtime code. */
import type { ChatbotMessage, ChatbotMessageMedia } from '../interfaces/chatbot-request.types'

export function makeMessage(overrides: Partial<ChatbotMessage> = {}): ChatbotMessage {
  return {
    id: `msg-${overrides.seq ?? 1}`,
    seq: 1,
    direction: 'IN',
    author: 'CUSTOMER',
    staff: null,
    type: 'TEXT',
    text: 'Hola, ¿tienen croquetas?',
    media: null,
    deliveryStatus: null,
    clientMessageId: null,
    providerTimestamp: '2026-11-12T16:02:11.000Z',
    createdAt: '2026-11-12T16:02:11.420Z',
    ...overrides,
  }
}

export function makeMedia(overrides: Partial<ChatbotMessageMedia> = {}): ChatbotMessageMedia {
  return {
    id: 'media-1',
    mimeType: 'image/jpeg',
    sizeBytes: 182_344,
    durationSec: null,
    hasThumb: false,
    purged: false,
    ...overrides,
  }
}
