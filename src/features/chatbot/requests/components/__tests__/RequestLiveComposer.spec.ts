import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { LiveAttachment } from '../../composables/useLiveChat'
import RequestLiveComposer from '../RequestLiveComposer.vue'

const STUBS = {
  UIcon: { template: '<span />' },
  UButton: {
    props: ['label', 'disabled', 'type', 'loading'],
    emits: ['click'],
    template:
      '<button :type="type || \'button\'" :disabled="disabled" @click="$emit(\'click\')"><slot>{{ label }}</slot></button>',
  },
  AppResponsiveDrawer: {
    props: ['open', 'title'],
    emits: ['update:open'],
    template: '<section v-if="open" data-testid="drawer"><h2>{{ title }}</h2><slot name="body" /></section>',
  },
}

const att = (overrides: Partial<LiveAttachment> = {}): LiveAttachment => ({
  name: 'foto-reposicion.jpg',
  size: 1_468_006,
  kind: 'IMAGE',
  status: 'ready',
  progress: 100,
  mediaId: 'media-1',
  error: null,
  ...overrides,
})

function mountComposer(props: Record<string, unknown> = {}) {
  return mount(RequestLiveComposer, {
    props: {
      modelValue: '',
      attachment: null,
      limit: 4096,
      overLimit: false,
      canSend: false,
      ...props,
    },
    global: { stubs: STUBS },
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('RequestLiveComposer — typing and sending', () => {
  it('is a labelled textarea with a live counter against 4,096', () => {
    const wrapper = mountComposer({ modelValue: 'Hola' })
    expect(wrapper.get('label').text()).toContain('Mensaje')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('Hola')
    expect(wrapper.get('[data-testid="composer-counter"]').text()).toBe('4 / 4,096')
  })

  it('emits update:modelValue while typing', async () => {
    const wrapper = mountComposer()
    await wrapper.get('textarea').setValue('Hola, soy Ana.')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['Hola, soy Ana.'])
  })

  it('Enter sends and stops the line break; Shift+Enter keeps the new line', async () => {
    const wrapper = mountComposer({ modelValue: 'Hola', canSend: true })
    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true })
    wrapper.get('textarea').element.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(true)
    expect(wrapper.emitted('send')).toHaveLength(1)

    const shift = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, cancelable: true, bubbles: true })
    wrapper.get('textarea').element.dispatchEvent(shift)
    expect(shift.defaultPrevented).toBe(false)
    expect(wrapper.emitted('send')).toHaveLength(1)
  })

  it('Enter while an input method is composing does not send', () => {
    const wrapper = mountComposer({ modelValue: 'Hola', canSend: true })
    const enter = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, cancelable: true, bubbles: true })
    wrapper.get('textarea').element.dispatchEvent(enter)
    expect(wrapper.emitted('send')).toBeUndefined()
  })

  it('Enter with nothing to send is swallowed without sending', () => {
    const wrapper = mountComposer({ modelValue: '', canSend: false })
    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true })
    wrapper.get('textarea').element.dispatchEvent(enter)
    expect(wrapper.emitted('send')).toBeUndefined()
  })

  it('the Enviar button follows canSend and submits the form', async () => {
    const off = mountComposer()
    expect(off.get('[data-testid="composer-send"]').attributes('disabled')).toBeDefined()
    const on = mountComposer({ modelValue: 'Hola', canSend: true })
    expect(on.get('[data-testid="composer-send"]').attributes('disabled')).toBeUndefined()
    await on.get('form').trigger('submit')
    expect(on.emitted('send')).toHaveLength(1)
  })

  it('explains the keys and that the text goes as written', () => {
    expect(mountComposer().text()).toContain('Enter envía')
    expect(mountComposer().text()).toContain('Shift+Enter')
  })
})

describe('RequestLiveComposer — the limit', () => {
  it('over the limit it marks the field and says how many to remove', () => {
    const wrapper = mountComposer({ modelValue: 'a'.repeat(4200), overLimit: true })
    expect(wrapper.get('textarea').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('[data-testid="composer-over"]').text()).toBe('Máximo 4,096 caracteres. Quita 104 para enviarlo.')
  })

  it('with an attachment the text becomes the caption (≤ 1,024)', () => {
    const wrapper = mountComposer({ attachment: att(), limit: 1024, modelValue: 'Así quedó' })
    expect(wrapper.get('textarea').attributes('placeholder')).toBe('Pie de foto (opcional)')
    expect(wrapper.get('label').text()).toContain('Pie de foto')
    expect(wrapper.get('[data-testid="composer-counter"]').text()).toBe('9 / 1,024')
  })
})

describe('RequestLiveComposer — attachments', () => {
  it('the clip opens the file picker restricted to JPEG, PNG, WebP and PDF', async () => {
    const wrapper = mountComposer()
    const input = wrapper.get('input[type="file"]')
    expect(input.attributes('accept')).toBe('image/jpeg,image/png,image/webp,application/pdf')
    const click = vi.spyOn(input.element as HTMLInputElement, 'click')
    await wrapper.get('[data-testid="composer-attach"]').trigger('click')
    expect(click).toHaveBeenCalled()
  })

  it('emits the picked file and clears the input so the same file can be picked again', async () => {
    const wrapper = mountComposer()
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    const input = wrapper.get('input[type="file"]').element as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    await wrapper.get('input[type="file"]').trigger('change')
    expect(wrapper.emitted('pick')![0]).toEqual([file])
  })

  it('shows the upload progress, then «Listo para enviar», and removes on ✕', async () => {
    const uploading = mountComposer({ attachment: att({ status: 'uploading', progress: 60 }) })
    const bar = uploading.get('[role="progressbar"]')
    expect(bar.attributes('aria-valuenow')).toBe('60')
    expect(uploading.text()).toContain('Subiendo… 60 %')

    const ready = mountComposer({ attachment: att() })
    expect(ready.text()).toContain('Listo para enviar · 1.4 MB')
    await ready.get('[data-testid="composer-attachment-remove"]').trigger('click')
    expect(ready.emitted('clear-attachment')).toHaveLength(1)
  })

  it('shows the error of a refused file on the attachment', () => {
    const wrapper = mountComposer({
      attachment: att({ status: 'error', error: 'foto-original.jpg pesa 14.2 MB. El máximo es 10 MB.', kind: null }),
    })
    expect(wrapper.get('[data-testid="composer-attachment-error"]').text()).toContain('pesa 14.2 MB')
  })

  it('on a small screen the clip opens a bottom sheet with «Foto o imagen» and «Documento PDF»', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} }))
    const wrapper = mountComposer()
    const input = wrapper.get('input[type="file"]')
    const click = vi.spyOn(input.element as HTMLInputElement, 'click')
    await wrapper.get('[data-testid="composer-attach"]').trigger('click')
    expect(click).not.toHaveBeenCalled()
    const sheet = wrapper.get('[data-testid="drawer"]')
    expect(sheet.text()).toContain('Foto o imagen')
    expect(sheet.text()).toContain('Documento PDF')

    await wrapper.get('[data-testid="attach-pick-pdf"]').trigger('click')
    expect(input.attributes('accept')).toBe('application/pdf')
    expect(click).toHaveBeenCalled()
  })
})

describe('RequestLiveComposer — T16: nothing carries from one request to the next', () => {
  const small = () =>
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} }))
  const pickFile = async (wrapper: ReturnType<typeof mountComposer>, file: File) => {
    const input = wrapper.get('input[type="file"]').element as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    await wrapper.get('input[type="file"]').trigger('change')
  }

  it('the attach sheet opened on A is closed when the request changes', async () => {
    small()
    const wrapper = mountComposer({ scope: 'req-A' })
    await wrapper.get('[data-testid="composer-attach"]').trigger('click')
    expect(wrapper.find('[data-testid="attach-sheet"]').exists()).toBe(true)

    await wrapper.setProps({ scope: 'req-B' })
    expect(wrapper.find('[data-testid="attach-sheet"]').exists()).toBe(false)
  })

  it('a file picked after the request changed is ignored (the dialog was opened for A)', async () => {
    const wrapper = mountComposer({ scope: 'req-A' })
    await wrapper.get('[data-testid="composer-attach"]').trigger('click')
    await wrapper.setProps({ scope: 'req-B' })
    await pickFile(wrapper, new File(['x'], 'foto.jpg', { type: 'image/jpeg' }))
    expect(wrapper.emitted('pick')).toBeUndefined()
  })

  it('a file picked from the sheet after the request changed is ignored too', async () => {
    small()
    const wrapper = mountComposer({ scope: 'req-A' })
    await wrapper.get('[data-testid="composer-attach"]').trigger('click')
    await wrapper.get('[data-testid="attach-pick-image"]').trigger('click')
    await wrapper.setProps({ scope: 'req-B' })
    await pickFile(wrapper, new File(['x'], 'foto.jpg', { type: 'image/jpeg' }))
    expect(wrapper.emitted('pick')).toBeUndefined()
  })

  it('a file picked on the same request still goes up, and B can pick its own after the switch', async () => {
    const wrapper = mountComposer({ scope: 'req-A' })
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })
    await wrapper.get('[data-testid="composer-attach"]').trigger('click')
    await pickFile(wrapper, file)
    expect(wrapper.emitted('pick')).toEqual([[file]])

    await wrapper.setProps({ scope: 'req-B' })
    await wrapper.get('[data-testid="composer-attach"]').trigger('click')
    const other = new File(['y'], 'otra.jpg', { type: 'image/jpeg' })
    await pickFile(wrapper, other)
    expect(wrapper.emitted('pick')).toEqual([[file], [other]])
  })
})

describe('RequestLiveComposer — waiting for the bot', () => {
  it('is disabled with the reason as placeholder', () => {
    const wrapper = mountComposer({ disabled: true, disabledText: 'Conectando…' })
    expect(wrapper.get('textarea').attributes('disabled')).toBeDefined()
    expect(wrapper.get('textarea').attributes('placeholder')).toBe('Conectando…')
    expect(wrapper.get('[data-testid="composer-attach"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="composer-send"]').attributes('disabled')).toBeDefined()
  })
})
