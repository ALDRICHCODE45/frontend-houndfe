import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { DETAIL_STUBS } from '../../utils/detail-fixture'
import { makeMedia, makeMessage } from '../../utils/conversation-fixture'
import { MEDIA_PURGED_COPY } from '../../utils/conversation-copy'

// The media composable is mocked: its own spec covers fetch, cache and object URL lifecycle.
const media = vi.hoisted(() => ({
  calls: [] as Array<{ id: unknown; options: Record<string, unknown> }>,
  state: null as null | Record<string, unknown>,
}))
vi.mock('../../composables/useChatbotMedia', () => ({
  useChatbotMedia: (id: unknown, options: Record<string, unknown> = {}) => {
    media.calls.push({ id, options })
    return media.state
  },
}))

import RequestConversationMessage from '../RequestConversationMessage.vue'

const TZ = 'America/Mexico_City'
const modalStub = {
  props: ['open', 'title'],
  template: '<div v-if="open" data-testid="viewer"><slot name="body" /></div>',
}
// Auto-imported Nuxt UI components resolve under their own name (`Modal`) as well.
const stubs = { ...DETAIL_STUBS, UModal: modalStub, Modal: modalStub }

function mediaState(overrides: Record<string, unknown> = {}) {
  return {
    url: ref<string | null>(null),
    blob: ref(null),
    isLoading: ref(false),
    isError: ref(false),
    isPurged: ref(false),
    errorMessage: ref<string | null>(null),
    refetch: vi.fn(),
    ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, ref(v)])),
  }
}

const mountMessage = (overrides = {}) =>
  mount(RequestConversationMessage, {
    props: { message: makeMessage(overrides), timeZone: TZ },
    global: { stubs },
  })

beforeEach(() => {
  media.calls = []
  media.state = mediaState()
})
afterEach(() => vi.unstubAllGlobals())

describe('RequestConversationMessage — side, author, time', () => {
  it('puts the customer on the left with «Cliente» and the local time', () => {
    const wrapper = mountMessage({ seq: 3, providerTimestamp: '2026-11-12T16:05:00.000Z' })
    const root = wrapper.get('[data-testid="conversation-message"]')
    expect(root.attributes('data-side')).toBe('them')
    expect(root.attributes('data-seq')).toBe('3')
    expect(root.classes()).toContain('rc-msg--them')
    expect(wrapper.get('[data-testid="message-meta"]').text()).toContain('Cliente')
    expect(wrapper.get('[data-testid="message-meta"]').text()).toContain('10:05')
  })

  it('puts the bot and staff on the right, each with its own label', () => {
    const bot = mountMessage({ author: 'BOT', direction: 'OUT', deliveryStatus: 'DELIVERED' })
    expect(bot.get('[data-testid="conversation-message"]').attributes('data-side')).toBe('bot')
    expect(bot.get('[data-testid="message-meta"]').text()).toContain('Bot')
    expect(bot.get('[data-testid="message-meta"]').text()).toContain('Entregado')

    const staff = mountMessage({
      author: 'STAFF',
      direction: 'OUT',
      staff: { id: 'u-1', displayName: 'Ana Ruiz' },
      deliveryStatus: 'READ',
    })
    expect(staff.get('[data-testid="conversation-message"]').attributes('data-side')).toBe('staff')
    expect(staff.get('[data-testid="message-meta"]').text()).toContain('Ana Ruiz')
    expect(staff.get('[data-testid="message-meta"]').text()).toContain('Leído')
  })

  it('shows no delivery state on a customer message', () => {
    const wrapper = mountMessage({ deliveryStatus: 'READ' })
    expect(wrapper.get('[data-testid="message-meta"]').text()).not.toContain('Leído')
  })
})

describe('RequestConversationMessage — text', () => {
  it('renders the text as text, never as HTML', () => {
    const wrapper = mountMessage({ text: '<b>hola</b><img src=x onerror=alert(1)>' })
    expect(wrapper.get('[data-testid="message-text"]').text()).toBe('<b>hola</b><img src=x onerror=alert(1)>')
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('keeps the line breaks of the customer (pre-wrap, one text node)', () => {
    const wrapper = mountMessage({ text: 'Línea 1\nLínea 2\n\nLínea 4' })
    const text = wrapper.get('[data-testid="message-text"]')
    expect(text.element.textContent).toBe('Línea 1\nLínea 2\n\nLínea 4')
    expect(text.classes()).toContain('rc-text')
  })

  it('renders no text block for a message without text', () => {
    const wrapper = mountMessage({ type: 'AUDIO', text: null, media: makeMedia({ mimeType: 'audio/ogg' }) })
    expect(wrapper.find('[data-testid="message-text"]').exists()).toBe(false)
  })

  it('marks an unsupported message (video, location) with its fixed text and no file', () => {
    const wrapper = mountMessage({ type: 'UNSUPPORTED', text: 'Video recibido' })
    expect(wrapper.get('[data-testid="message-text"]').text()).toBe('Video recibido')
    expect(wrapper.find('[data-testid="message-unsupported"]').exists()).toBe(true)
    expect(media.calls).toHaveLength(0)
  })

  it('labels a template sent by the bot', () => {
    const wrapper = mountMessage({ type: 'TEMPLATE', author: 'BOT', direction: 'OUT', text: 'Tu pedido está listo' })
    expect(wrapper.get('[data-testid="message-template"]').text()).toContain('Plantilla')
    expect(wrapper.get('[data-testid="message-text"]').text()).toBe('Tu pedido está listo')
  })

  it('renders a system message centred without a bubble author', () => {
    const wrapper = mountMessage({ type: 'SYSTEM', author: 'SYSTEM', direction: 'OUT', text: 'Sesión iniciada' })
    expect(wrapper.get('[data-testid="conversation-message"]').attributes('data-side')).toBe('system')
    expect(wrapper.get('[data-testid="message-text"]').text()).toBe('Sesión iniciada')
  })
})

describe('RequestConversationMessage — image and sticker', () => {
  it('shows a loading placeholder until the blob arrives, then the image from the object URL with the caption', async () => {
    const state = mediaState({ isLoading: true })
    media.state = state
    const wrapper = mountMessage({ type: 'IMAGE', text: 'Así se ve', media: makeMedia() })
    expect(wrapper.find('[data-testid="media-loading"]').exists()).toBe(true)
    expect(wrapper.find('img').exists()).toBe(false)

    state.isLoading.value = false
    state.url.value = 'blob:app/1'
    await flushPromises()
    expect(wrapper.get('img').attributes('src')).toBe('blob:app/1')
    expect(wrapper.get('[data-testid="message-text"]').text()).toBe('Así se ve')
    expect((media.calls[0]!.id as () => string)()).toBe('media-1')
  })

  it('opens a larger view on click and closes it', async () => {
    media.state = mediaState({ url: 'blob:app/1' })
    const wrapper = mountMessage({ type: 'IMAGE', media: makeMedia() })
    expect(wrapper.find('[data-testid="viewer"]').exists()).toBe(false)

    await wrapper.get('[data-testid="media-open-image"]').trigger('click')
    const viewer = wrapper.get('[data-testid="viewer"]')
    expect(viewer.get('img').attributes('src')).toBe('blob:app/1')
  })

  it('shows a sticker inline and also opens it larger', async () => {
    media.state = mediaState({ url: 'blob:app/2' })
    const wrapper = mountMessage({ type: 'STICKER', text: null, media: makeMedia({ mimeType: 'image/webp' }) })
    expect(wrapper.find('[data-testid="media-sticker"]').exists()).toBe(true)
    expect(wrapper.get('img').attributes('src')).toBe('blob:app/2')
    await wrapper.get('[data-testid="media-open-image"]').trigger('click')
    expect(wrapper.find('[data-testid="viewer"]').exists()).toBe(true)
  })

  it('fetches only when visible: without IntersectionObserver it is immediately', () => {
    mountMessage({ type: 'IMAGE', media: makeMedia() })
    expect(media.calls[0]!.options.enabled).toBeDefined()
    const enabled = media.calls[0]!.options.enabled as { value: boolean }
    expect(enabled.value).toBe(true)
  })

  it('shows the retention copy for a purged file, with no retry and no request', () => {
    media.state = mediaState({ isError: true, isPurged: true, errorMessage: MEDIA_PURGED_COPY })
    const wrapper = mountMessage({ type: 'IMAGE', media: makeMedia({ purged: true, mimeType: null, sizeBytes: null }) })
    expect(wrapper.get('[data-testid="media-error"]').text()).toContain(
      'Este archivo ya no está disponible (se elimina a los 12 meses)',
    )
    expect(wrapper.find('[data-testid="media-retry"]').exists()).toBe(false)
    expect((media.calls[0]!.options.purged as { value: boolean }).value).toBe(true)
  })

  it('shows a retry for a failed file and asks again', async () => {
    const state = mediaState({ isError: true, errorMessage: 'No se pudo cargar el archivo. Revisa tu conexión e inténtalo de nuevo.' })
    media.state = state
    const wrapper = mountMessage({ type: 'IMAGE', media: makeMedia() })
    expect(wrapper.get('[data-testid="media-error"]').text()).toContain('inténtalo de nuevo')
    await wrapper.get('[data-testid="media-retry"]').trigger('click')
    expect(state.refetch).toHaveBeenCalledTimes(1)
  })
})

describe('RequestConversationMessage — PDF', () => {
  const open = vi.fn()
  beforeEach(() => {
    open.mockReset()
    vi.stubGlobal('open', open)
  })

  it('is a file chip that does not fetch until it is clicked', () => {
    const wrapper = mountMessage({ type: 'DOCUMENT', text: 'Constancia', media: makeMedia({ mimeType: 'application/pdf', sizeBytes: 182_344 }) })
    const chip = wrapper.get('[data-testid="media-pdf"]')
    expect(chip.text()).toContain('PDF')
    expect(chip.text()).toContain('178 KB')
    expect((media.calls[0]!.options.enabled as { value: boolean }).value).toBe(false)
    expect(wrapper.get('[data-testid="message-text"]').text()).toBe('Constancia')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('opens a tab right away (popup rules), asks for the file and points the tab at the blob URL', async () => {
    const tab = { location: { href: '' }, close: vi.fn(), opener: {} as unknown }
    open.mockReturnValue(tab)
    const state = mediaState()
    media.state = state
    const wrapper = mountMessage({ type: 'DOCUMENT', media: makeMedia({ mimeType: 'application/pdf' }) })

    await wrapper.get('[data-testid="media-pdf"]').trigger('click')
    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(tab.opener).toBeNull()
    expect((media.calls[0]!.options.enabled as { value: boolean }).value).toBe(true)

    state.url.value = 'blob:app/9'
    await flushPromises()
    expect(tab.location.href).toBe('blob:app/9')
  })

  it('opens the blob URL directly when the file is already loaded', async () => {
    media.state = mediaState({ url: 'blob:app/9' })
    const wrapper = mountMessage({ type: 'DOCUMENT', media: makeMedia({ mimeType: 'application/pdf' }) })
    // first click requests it; the url is already there, so the tab goes to it at once
    await wrapper.get('[data-testid="media-pdf"]').trigger('click')
    await flushPromises()
    expect(open).toHaveBeenCalled()
  })

  it('closes the blank tab and shows the error when the file cannot be read', async () => {
    const tab = { location: { href: '' }, close: vi.fn(), opener: {} as unknown }
    open.mockReturnValue(tab)
    const state = mediaState()
    media.state = state
    const wrapper = mountMessage({ type: 'DOCUMENT', media: makeMedia({ mimeType: 'application/pdf' }) })
    await wrapper.get('[data-testid="media-pdf"]').trigger('click')

    state.isError.value = true
    state.errorMessage.value = MEDIA_PURGED_COPY
    await flushPromises()
    expect(tab.close).toHaveBeenCalled()
    expect(wrapper.get('[data-testid="media-error"]').text()).toContain('se elimina a los 12 meses')
  })

  it('is disabled and says why for a purged PDF', () => {
    media.state = mediaState({ isError: true, isPurged: true, errorMessage: MEDIA_PURGED_COPY })
    const wrapper = mountMessage({ type: 'DOCUMENT', media: makeMedia({ purged: true, mimeType: null, sizeBytes: null }) })
    expect(wrapper.find('[data-testid="media-pdf"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="media-error"]').text()).toContain('se elimina a los 12 meses')
  })
})

describe('RequestConversationMessage — voice note', () => {
  it('asks to load it on demand, then plays it from the blob with native controls', async () => {
    const state = mediaState()
    media.state = state
    const wrapper = mountMessage({ type: 'AUDIO', text: null, media: makeMedia({ mimeType: 'audio/ogg', sizeBytes: 40_000 }) })
    expect((media.calls[0]!.options.enabled as { value: boolean }).value).toBe(false)
    expect(wrapper.find('audio').exists()).toBe(false)

    await wrapper.get('[data-testid="media-load-audio"]').trigger('click')
    expect((media.calls[0]!.options.enabled as { value: boolean }).value).toBe(true)

    state.url.value = 'blob:app/5'
    await flushPromises()
    const audio = wrapper.get('audio')
    expect(audio.attributes('src')).toBe('blob:app/5')
    expect(audio.attributes('controls')).toBeDefined()
    expect(wrapper.find('[data-testid="media-load-audio"]').exists()).toBe(false)
  })

  it('shows the retention copy for a purged voice note instead of the button', () => {
    media.state = mediaState({ isError: true, isPurged: true, errorMessage: MEDIA_PURGED_COPY })
    const wrapper = mountMessage({ type: 'AUDIO', text: null, media: makeMedia({ purged: true, mimeType: null }) })
    expect(wrapper.find('[data-testid="media-load-audio"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="media-error"]').text()).toContain('se elimina a los 12 meses')
  })
})
