import type { InjectionKey, Ref } from 'vue'

/**
 * Provided by the conversation block when the viewer reads the thread as the attendee of the live
 * session (no `read:ChatbotConversation`): the media proxy then lets them open the files of that
 * session (handoff 20 §3b), so the bubbles' `useChatbotMedia` must not gate on the permission.
 */
export const ATTENDEE_MEDIA_KEY: InjectionKey<Readonly<Ref<boolean>>> = Symbol('chatbot-attendee-media')
